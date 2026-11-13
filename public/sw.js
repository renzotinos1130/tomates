/*
 * Tomate HQ — service worker.
 *
 * It does one thing: receive push notifications, show them, and open the app at
 * the right place when one is tapped. Nothing is cached and no request is
 * intercepted: the app always comes from the network, as without it.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Only a path inside the app: a message never sends anyone elsewhere. */
function insideApp(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Tomate HQ";
  // Every push shows a notification: browsers (Safari first) withdraw the right to push from a site that receives in silence.
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
      icon: "/icons/app-192.png",
      badge: "/icons/badge-96.png",
      lang: "fr-CA",
      data: { url: insideApp(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = insideApp(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        // The app is running: bring it forward and let it go there itself, without reloading.
        await open.focus().catch(() => undefined);
        open.postMessage({ type: "push-open", url: path });
        return;
      }
      await self.clients.openWindow(new URL(path, self.location.origin).href);
    })(),
  );
});
