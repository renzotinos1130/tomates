/**
 * Push notifications, on the device: the service worker, the browser's
 * permission and its subscription. What is kept (my devices, my choices) goes
 * through the adapter, like everything else.
 */
import { deviceLabel, keyBytes, pushSupport, type PushOutcome } from "./push";
import { getAdapter } from "./store";

const WORKER = "/sw.js";
const fail = (error: string) => ({ ok: false as const, error });

/** The service worker, registered if it was not yet. Null where there cannot be one. */
export async function pushWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    // `updateViaCache: none`: a new version of the worker is never held back by a cached copy.
    return await navigator.serviceWorker.register(WORKER, { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

/** This device's subscription, when it has one and notifications are still allowed. */
export async function pushSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return null;
  const worker = await pushWorker();
  return (await worker?.pushManager.getSubscription().catch(() => null)) ?? null;
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false;
  const bytes = new Uint8Array(a);
  return bytes.length === b.length && bytes.every((v, i) => v === b[i]);
};

async function save(subscription: PushSubscription): Promise<PushOutcome> {
  const keys = subscription.toJSON().keys ?? {};
  if (!keys.p256dh || !keys.auth) return fail("Cet appareil n'a pas pu être enregistré : son abonnement est incomplet.");
  return getAdapter().pushSubscribe({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth, device: deviceLabel() });
}

/**
 * Turns notifications on for this device. Call it from a click: browsers only
 * ask the person's permission in answer to a gesture, and the iPhone only in
 * the installed app.
 */
export async function enablePush(publicKey: string): Promise<PushOutcome> {
  if (pushSupport() !== "ok") return fail("Ce navigateur ne peut pas recevoir de notifications.");
  // First thing, while the click is still fresh.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return fail(
      permission === "denied"
        ? "Les notifications sont bloquées pour cette application : autorisez-les dans les réglages de l'appareil, puis réessayez."
        : "Les notifications n'ont pas été autorisées.",
    );
  }
  const worker = await pushWorker();
  if (!worker) return fail("Le service de notifications n'a pas pu démarrer sur cet appareil.");
  try {
    await navigator.serviceWorker.ready;
    const key = keyBytes(publicKey);
    let subscription = await worker.pushManager.getSubscription();
    // A subscription made with other keys (they were replaced on the server) can no longer be written to.
    if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    return await save(subscription);
  } catch (err) {
    console.error("[push] enable", err);
    return fail("Les notifications n'ont pas pu être activées sur cet appareil. Réessayez dans un instant.");
  }
}

/** Turns notifications off for this device: the server forgets it, then the browser does. */
export async function disablePush(): Promise<PushOutcome> {
  const worker = await pushWorker();
  const subscription = await worker?.pushManager.getSubscription().catch(() => null);
  if (!subscription) return { ok: true };
  const out = await getAdapter().pushUnsubscribe(subscription.endpoint);
  await subscription.unsubscribe().catch(() => false);
  return out;
}

/**
 * At the start of the app: registers the worker, and if this device is
 * subscribed, says so again to the server. That is what keeps a device working
 * after its keys change, and what moves it to whoever signs in on it.
 */
export async function syncPush(): Promise<void> {
  try {
    if (pushSupport() !== "ok") return;
    await pushWorker();
    const subscription = await pushSubscription();
    if (subscription) await save(subscription);
  } catch {
    /* the next start tries again */
  }
}

/** Signing out: this device stops receiving for me. The browser keeps its subscription for whoever signs in next. */
export async function forgetPush(): Promise<void> {
  try {
    const subscription = await pushSubscription();
    if (subscription) await getAdapter().pushUnsubscribe(subscription.endpoint);
  } catch {
    /* signing out goes on */
  }
}

/** Shows a notification from the page itself (the demo's « essai »: nothing travels). */
export async function showLocalNotification(title: string, body: string, url: string): Promise<boolean> {
  const worker = await pushWorker();
  if (!worker || Notification.permission !== "granted") return false;
  await navigator.serviceWorker.ready;
  await worker.showNotification(title, { body, icon: "/icons/app-192.png", badge: "/icons/badge-96.png", tag: "essai", lang: "fr-CA", data: { url } });
  return true;
}
