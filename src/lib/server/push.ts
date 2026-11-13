"use server";

/**
 * Push notifications, as a browser reaches them.
 *
 *  - getPushState      whether the server can send, its public key, my choices
 *                      and my devices (never their addresses or keys).
 *  - subscribePush     saves this device for me. A device belongs to one member
 *                      at a time: the last one who turned notifications on.
 *  - unsubscribePush   forgets this device (turned off here, or signing out).
 *  - removePushDevice  forgets one of my devices, from the list.
 *  - setPushPrefs      what I want to hear about.
 *  - sendTestPush      one message to this device, to see that it arrives.
 *  - kickPush          « something just happened »: sends what the database has
 *                      queued. It announces nothing by itself: the outbox is
 *                      written by the database, in the transaction of the change.
 *
 * Each function first works out who is asking, from the session cookie, and
 * that they are an active member. The tables are closed to the API: these
 * functions, with the service key, are the only way in.
 */
import { DEFAULT_PUSH_PREFS, type PushOutcome, type PushPrefs, type PushState, type PushSubscriptionInput } from "@/lib/push";
import { getSupabaseAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { deliver, dispatchPush, endpointAllowed, isPushConfigured, vapid, type Device } from "./push-dispatch";
import { activeMemberId } from "./session";

const NOT_CONFIGURED = "Les notifications ne sont pas configurées sur ce serveur.";
const NOT_ALLOWED = "Réservé aux membres de l'équipe.";
const UNEXPECTED = "Une erreur est survenue. Réessayez dans un instant.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Devices one member can keep: far more than anyone owns. The oldest goes first. */
const DEVICES_KEPT = 12;

const fail = (error: string) => ({ ok: false as const, error });
const OFF: PushState = { configured: false, publicKey: null, prefs: DEFAULT_PUSH_PREFS, devices: [] };

/** Raw bytes of a base64url value, or null when it is not one. */
function decoded(value: unknown): Buffer | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  return Buffer.from(value, "base64url");
}

/** The host of an address, and nothing else of it (the rest is the device's secret). */
function hostOf(value: unknown): string {
  try {
    return new URL(String(value)).host.slice(0, 80);
  } catch {
    return "(not an address)";
  }
}

const cleanEndpoint = (value: unknown) => (typeof value === "string" && value.length <= 2000 && endpointAllowed(value) ? value : null);

async function prefsOf(memberId: string): Promise<PushPrefs> {
  const { data } = await getSupabaseAdminClient()
    .from("push_prefs")
    .select("task_created, task_done, task_blocked, tower_record, scope")
    .eq("member_id", memberId)
    .maybeSingle();
  return { ...DEFAULT_PUSH_PREFS, ...((data as Partial<PushPrefs> | null) ?? {}) };
}

export async function getPushState(endpoint: string | null): Promise<PushState> {
  if (!isSupabaseConfigured || !isAdminConfigured) return OFF;
  try {
    const me = await activeMemberId();
    if (!me) return OFF;
    const { data: rows } = await getSupabaseAdminClient()
      .from("push_subscriptions")
      .select("id, endpoint, device, created_at")
      .eq("member_id", me)
      .order("created_at", { ascending: true });
    return {
      configured: isPushConfigured(),
      publicKey: vapid()?.publicKey ?? null,
      prefs: await prefsOf(me),
      devices: ((rows ?? []) as { id: string; endpoint: string; device: string; created_at: string }[]).map((d) => ({
        id: d.id,
        device: d.device,
        created_at: d.created_at,
        current: !!endpoint && d.endpoint === endpoint,
      })),
    };
  } catch (err) {
    console.error("[push] getPushState", err instanceof Error ? err.message : err);
    return OFF;
  }
}

export async function subscribePush(input: PushSubscriptionInput): Promise<PushOutcome> {
  if (!isPushConfigured()) return fail(NOT_CONFIGURED);
  try {
    const me = await activeMemberId();
    if (!me) return fail(NOT_ALLOWED);
    const endpoint = cleanEndpoint(input?.endpoint);
    const p256dh = decoded(input?.p256dh);
    const auth = decoded(input?.auth);
    // A P-256 public key, uncompressed (65 bytes), and the 16 bytes of the device's secret.
    if (!endpoint || !p256dh || p256dh.length !== 65 || p256dh[0] !== 4 || !auth || auth.length !== 16) {
      // Which push service it was, for whoever reads the server log: a browser we do not know yet would show here.
      console.error("[push] device refused", endpoint ? "keys" : `address ${hostOf(input?.endpoint)}`);
      return fail("Cet appareil n'a pas pu être enregistré : son abonnement n'est pas reconnu.");
    }
    const device = typeof input.device === "string" ? input.device.replace(/[^\p{L}\p{N} ·.\-]/gu, "").trim().slice(0, 60) : "";
    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("push_subscriptions").upsert(
      { member_id: me, endpoint, p256dh: p256dh.toString("base64url"), auth: auth.toString("base64url"), device, seen_at: new Date().toISOString() },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("[push] subscribePush", error.message);
      return fail(UNEXPECTED);
    }
    const { data: mine } = await admin.from("push_subscriptions").select("id").eq("member_id", me).order("seen_at", { ascending: false });
    const extra = ((mine ?? []) as { id: string }[]).slice(DEVICES_KEPT).map((d) => d.id);
    if (extra.length) await admin.from("push_subscriptions").delete().in("id", extra);
    return { ok: true };
  } catch (err) {
    console.error("[push] subscribePush", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

export async function unsubscribePush(endpoint: string): Promise<PushOutcome> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const me = await activeMemberId();
    if (!me) return fail(NOT_ALLOWED);
    if (typeof endpoint !== "string" || endpoint.length > 2000) return { ok: true };
    const { error } = await getSupabaseAdminClient().from("push_subscriptions").delete().eq("member_id", me).eq("endpoint", endpoint);
    return error ? fail(UNEXPECTED) : { ok: true };
  } catch (err) {
    console.error("[push] unsubscribePush", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

export async function removePushDevice(id: string): Promise<PushOutcome> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const me = await activeMemberId();
    if (!me) return fail(NOT_ALLOWED);
    if (typeof id !== "string" || !UUID.test(id)) return fail("Cet appareil est inconnu.");
    const { error } = await getSupabaseAdminClient().from("push_subscriptions").delete().eq("member_id", me).eq("id", id);
    return error ? fail(UNEXPECTED) : { ok: true };
  } catch (err) {
    console.error("[push] removePushDevice", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

export async function setPushPrefs(patch: Partial<PushPrefs>): Promise<PushOutcome<{ prefs: PushPrefs }>> {
  if (!isSupabaseConfigured || !isAdminConfigured) return fail(NOT_CONFIGURED);
  try {
    const me = await activeMemberId();
    if (!me) return fail(NOT_ALLOWED);
    // Only what changes is written: two switches flipped one after the other never undo each other.
    const change: Partial<PushPrefs> = {};
    for (const key of ["task_created", "task_done", "task_blocked", "tower_record"] as const) {
      if (typeof patch?.[key] === "boolean") change[key] = patch[key];
    }
    if (patch?.scope === "team" || patch?.scope === "mine") change.scope = patch.scope;
    const { data, error } = await getSupabaseAdminClient()
      .from("push_prefs")
      .upsert({ member_id: me, ...change, updated_at: new Date().toISOString() }, { onConflict: "member_id" })
      .select("task_created, task_done, task_blocked, tower_record, scope")
      .single();
    if (error || !data) {
      console.error("[push] setPushPrefs", error?.message);
      return fail(UNEXPECTED);
    }
    return { ok: true, prefs: { ...DEFAULT_PUSH_PREFS, ...(data as Partial<PushPrefs>) } };
  } catch (err) {
    console.error("[push] setPushPrefs", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

export async function sendTestPush(endpoint: string): Promise<PushOutcome> {
  const keys = vapid();
  if (!keys || !isPushConfigured()) return fail(NOT_CONFIGURED);
  try {
    const me = await activeMemberId();
    if (!me) return fail(NOT_ALLOWED);
    const { data } = await getSupabaseAdminClient()
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("member_id", me)
      .eq("endpoint", typeof endpoint === "string" ? endpoint : "")
      .maybeSingle();
    if (!data) return fail("Cet appareil n'est plus abonné : réactivez les notifications.");
    const [result] = await deliver(
      [
        {
          device: data as Device,
          message: {
            title: "Tomate HQ",
            body: "Les notifications fonctionnent sur cet appareil 🍅",
            url: "/parametres?section=notifications",
            tag: "essai",
          },
        },
      ],
      keys,
    );
    if (result === "sent") return { ok: true };
    if (result === "gone") return fail("Cet appareil n'est plus abonné : réactivez les notifications.");
    return fail("L'essai n'a pas pu être envoyé. Réessayez dans un instant.");
  } catch (err) {
    console.error("[push] sendTestPush", err instanceof Error ? err.message : err);
    return fail(UNEXPECTED);
  }
}

export async function kickPush(): Promise<void> {
  if (!isPushConfigured()) return;
  try {
    if (!(await activeMemberId())) return;
    await dispatchPush();
  } catch (err) {
    console.error("[push] kickPush", err instanceof Error ? err.message : err);
  }
}
