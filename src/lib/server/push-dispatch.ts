import "server-only";

/**
 * Sending push notifications. Server only, and not a Server Function file: none
 * of this can be called from a browser (lib/server/push.ts is what a browser
 * reaches, after it has checked who is asking).
 *
 *  - `vapid()`          the server's keys, from the environment.
 *  - `endpointAllowed`  the only addresses a message is ever sent to: the push
 *                       services of the browsers, never an address of our own.
 *  - `sendPush`         seals one message for one device and hands it to the
 *                       browser's push service.
 *  - `dispatchPush`     takes what the database has put in the outbox, works out
 *                       who is told what (lib/push.ts) and sends it.
 *
 * A message is sealed for the device it goes to (the web-push library: RFC 8291
 * and 8292): the push service carries it without being able to read it.
 */
import { generateRequestDetails } from "web-push";
import { DEFAULT_PUSH_PREFS, planPush, type PushContext, type PushEvent, type PushMessage, type PushPrefs } from "@/lib/push";
import { getSupabaseAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** An announcement older than this is not sent: late news is noise. */
const FRESH_FOR_MS = 15 * 60 * 1000;
/** How long a push service keeps a message for a device that is off. */
const TTL_SECONDS = 24 * 60 * 60;
const SEND_TIMEOUT_MS = 8000;
const AT_ONCE = 8;

/**
 * Where browsers receive their pushes. A subscription names its own address:
 * anything else (an address inside our network, another site) is refused, when
 * the device is saved and again when a message leaves.
 */
const PUSH_SERVICES = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Brave, Opera…
  /^([a-z0-9-]+\.)*push\.apple\.com$/, // Safari, iPhone and iPad (installed app)
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge on Windows
];

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** The keys the server signs with, or null when it has none (notifications are then off everywhere). */
export function vapid(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // Who to reach about these messages, as push services ask: the address of the app (never a person's).
  // Apple refuses a message whose subject is not a real https or mailto address.
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || (site ? `https://${site}` : "");
  if (!/^(https:\/\/|mailto:)\S+$/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

export const isPushConfigured = () => isSupabaseConfigured && isAdminConfigured && vapid() !== null;

export function endpointAllowed(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // Tests only: one extra origin (a stand-in for a push service, on this machine). Never set in production.
  const extra = process.env.PUSH_EXTRA_ENDPOINT_ORIGIN?.trim();
  if (extra && url.origin === extra) return true;
  return url.protocol === "https:" && !url.username && !url.password && PUSH_SERVICES.some((host) => host.test(url.hostname));
}

export interface Device {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** `gone`: the push service says this device is no longer subscribed; its row can go. */
export type Sent = "sent" | "gone" | "failed";

export async function sendPush(device: Device, message: PushMessage, keys: VapidKeys): Promise<Sent> {
  if (!endpointAllowed(device.endpoint)) return "failed";
  try {
    const request = generateRequestDetails({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, JSON.stringify(message), {
      vapidDetails: keys,
      TTL: TTL_SECONDS,
      urgency: "normal",
      // A device that was off receives the latest lead at the game, not each one in turn.
      ...(message.tag === "tower_record" ? { topic: "tower-record" } : {}),
    });
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(request.headers)) if (name.toLowerCase() !== "content-length") headers[name] = String(value);
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers,
      body: new Uint8Array(request.body as Buffer),
      redirect: "error",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (response.ok) return "sent";
    if (response.status === 404 || response.status === 410) return "gone";
    const said = (await response.text().catch(() => "")).slice(0, 200);
    console.error("[push] refused", new URL(device.endpoint).hostname, response.status, said);
    return "failed";
  } catch (err) {
    console.error("[push] not sent", err instanceof Error ? err.message : err);
    return "failed";
  }
}

/** Runs the jobs a few at a time: a team's worth of devices, not a flood. */
async function inBatches<T>(jobs: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < jobs.length; i += AT_ONCE) results.push(...(await Promise.all(jobs.slice(i, i + AT_ONCE).map((job) => job()))));
  return results;
}

/** Sends messages to devices and forgets the devices the push services no longer know. */
export async function deliver(jobs: { device: Device; message: PushMessage }[], keys: VapidKeys): Promise<Sent[]> {
  const results = await inBatches(jobs.map(({ device, message }) => () => sendPush(device, message, keys)));
  const gone = [...new Set(jobs.filter((_, i) => results[i] === "gone").map((j) => j.device.id))];
  if (gone.length) await getSupabaseAdminClient().from("push_subscriptions").delete().in("id", gone);
  return results;
}

/**
 * Announces what is pending. Safe to call from anywhere on the server, as often
 * as wanted: the database hands each row over once, whoever asks.
 * Returns how many messages left.
 */
export async function dispatchPush(): Promise<number> {
  const keys = vapid();
  if (!keys || !isSupabaseConfigured || !isAdminConfigured) return 0;
  const admin = getSupabaseAdminClient();
  let sent = 0;

  // A second look when the first batch was full; a third would mean something is flooding the outbox.
  for (let round = 0; round < 3; round++) {
    const { data: claimed, error } = await admin.rpc("push_claim", { p_limit: 200 });
    if (error) {
      console.error("[push] claim", error.message);
      return sent;
    }
    const rows = (claimed ?? []) as (PushEvent & { created_at: string })[];
    if (rows.length === 0) return sent;
    const events = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < FRESH_FOR_MS);
    if (events.length) sent += await announce(events, keys);
    if (rows.length < 200) return sent;
  }
  return sent;
}

async function announce(events: PushEvent[], keys: VapidKeys): Promise<number> {
  const admin = getSupabaseAdminClient();
  const taskIds = [...new Set(events.map((e) => e.task_id).filter((id): id is string => !!id))];
  const [devices, members, prefs, tasks, projects] = await Promise.all([
    admin.from("push_subscriptions").select("id, member_id, endpoint, p256dh, auth"),
    admin.from("members").select("id, full_name, active"),
    admin.from("push_prefs").select("member_id, task_created, task_done, task_blocked, tower_record, scope"),
    taskIds.length
      ? admin.from("tasks").select("id, title, project_id, assignee_id, created_by, archived_at").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("projects").select("id, name, slug, archived_at"),
  ]);
  const failed = [devices, members, prefs, tasks, projects].find((r) => r.error);
  if (failed?.error) {
    console.error("[push] read", failed.error.message);
    return 0;
  }

  type DeviceRow = Device & { member_id: string };
  const byMember = new Map<string, DeviceRow[]>();
  for (const d of (devices.data ?? []) as DeviceRow[]) byMember.set(d.member_id, [...(byMember.get(d.member_id) ?? []), d]);
  if (byMember.size === 0) return 0;

  const index = <T extends { id: string }>(rows: T[] | null) => Object.fromEntries((rows ?? []).map((r) => [r.id, r])) as Record<string, T>;
  const context: PushContext = {
    members: index(members.data as PushContext["members"][string][]),
    prefs: Object.fromEntries(
      ((prefs.data ?? []) as (PushPrefs & { member_id: string })[]).map(({ member_id, ...rest }) => [member_id, { ...DEFAULT_PUSH_PREFS, ...rest }]),
    ),
    tasks: index(tasks.data as PushContext["tasks"][string][]),
    projects: index(projects.data as PushContext["projects"][string][]),
    recipients: [...byMember.keys()],
  };

  const jobs: { device: Device; message: PushMessage }[] = [];
  for (const [memberId, messages] of planPush(events, context)) {
    for (const message of messages) for (const device of byMember.get(memberId) ?? []) jobs.push({ device, message });
  }
  if (jobs.length === 0) return 0;
  const results = await deliver(jobs, keys);
  return results.filter((r) => r === "sent").length;
}
