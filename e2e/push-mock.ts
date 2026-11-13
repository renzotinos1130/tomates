/**
 * Un service de push de remplacement, pour les tests : le navigateur de test n'a pas celui de Google.
 * S'abonner répond aussitôt, avec une adresse et des clés fixes, et le navigateur s'en souvient d'un
 * chargement à l'autre, comme un vrai. À passer à `page.addInitScript` (la fonction est envoyée telle
 * quelle dans la page : elle ne peut rien utiliser d'autre que ce qu'elle contient).
 */
export function pushServiceStandIn() {
  const KEY = "__test_push_subscription";
  interface Saved {
    endpoint: string;
    p256dh: string;
    auth: string;
    serverKey: string;
  }
  const read = (): Saved | null => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    } catch {
      return null;
    }
  };
  const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const wrap = (saved: Saved | null) =>
    saved && {
      endpoint: saved.endpoint,
      expirationTime: null,
      options: { userVisibleOnly: true, applicationServerKey: bytes(saved.serverKey).buffer },
      toJSON: () => ({ endpoint: saved.endpoint, expirationTime: null, keys: { p256dh: saved.p256dh, auth: saved.auth } }),
      unsubscribe: async () => {
        localStorage.removeItem(KEY);
        return true;
      },
    };
  const manager = PushManager.prototype as unknown as {
    getSubscription: () => Promise<unknown>;
    subscribe: (options: { applicationServerKey: Uint8Array }) => Promise<unknown>;
  };
  manager.getSubscription = async () => wrap(read());
  manager.subscribe = async (options) => {
    const saved: Saved = {
      endpoint: "https://fcm.googleapis.com/fcm/send/appareil-de-test",
      // Une vraie clé publique P-256 (65 octets) et un secret de 16 octets, comme un navigateur en donne.
      p256dh: "BArb4MMJysdSyal1L5xfzweYKsD4nT--GxFH6H9oOKcta6L90meNgpLNxabIt-wlQoyzfDdXKNmyXrm_jQlUq9c",
      auth: "AAAAAAAAAAAAAAAAAAAAAA",
      serverKey: btoa(String.fromCharCode(...options.applicationServerKey)),
    };
    localStorage.setItem(KEY, JSON.stringify(saved));
    return wrap(saved);
  };
}
