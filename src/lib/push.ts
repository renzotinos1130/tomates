/**
 * Push notifications: what is shared by the browser and the server, and the
 * rules that decide who is told what.
 *
 * The database writes what happened (a task created, handed over, finished or
 * blocked; a new lead or a new record at Tomato Tower) in an outbox. `planPush` turns a batch
 * of those rows into the messages each member receives. It is a pure function:
 * the server (lib/server/push-dispatch.ts) reads the rows, calls it and sends;
 * the tests call it with rows of their own.
 */
import type { ID } from "./types";
import { firstName } from "./utils";

export type PushKind = "task_created" | "task_assigned" | "task_done" | "task_blocked" | "tower_record";

/** What a member wants to hear about. */
export interface PushPrefs {
  task_created: boolean;
  task_done: boolean;
  task_blocked: boolean;
  tower_record: boolean;
  /** `team`: every task of the team. `mine`: only the tasks I am responsible for or created. */
  scope: "team" | "mine";
}

export const DEFAULT_PUSH_PREFS: PushPrefs = { task_created: true, task_done: true, task_blocked: true, tower_record: true, scope: "team" };

/** The four switches of the settings, in their order. */
export const PUSH_TOPICS: { key: keyof Omit<PushPrefs, "scope">; label: string; hint: string }[] = [
  { key: "task_created", label: "Nouvelle tâche", hint: "Une tâche est créée, ou vous est confiée." },
  { key: "task_done", label: "Tâche terminée", hint: "Quelqu'un termine une tâche." },
  { key: "task_blocked", label: "Tâche bloquée", hint: "Quelqu'un signale un blocage." },
  { key: "tower_record", label: "Record à Tomato Tower", hint: "Quelqu'un prend la tête de la semaine, ou le record de tous les temps." },
];

/** A device of mine that receives notifications, as the settings list it. */
export interface PushDevice {
  id: string;
  device: string;
  created_at: string;
  /** The device this page is open on. */
  current: boolean;
}

export interface PushState {
  /** False when the server has no keys to send with: nothing can be turned on. */
  configured: boolean;
  /** The server's public key, which a browser subscribes with. */
  publicKey: string | null;
  prefs: PushPrefs;
  devices: PushDevice[];
}

export type PushOutcome<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** What the browser's push service hands the page when notifications are turned on. */
export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  device: string;
}

/** What a device receives and shows. */
export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap on the notification leads, inside the app. */
  url: string;
  /** A later message with the same tag takes the place of the earlier one. */
  tag: string;
}

/** A row of the outbox. */
export interface PushEvent {
  id: number;
  kind: PushKind;
  actor_id: ID | null;
  task_id: ID | null;
  detail: Record<string, unknown>;
}

export interface PushContext {
  members: Record<ID, { id: ID; full_name: string; active: boolean }>;
  /** A member without a row here has the defaults. */
  prefs: Record<ID, PushPrefs>;
  tasks: Record<ID, { id: ID; title: string; project_id: ID; assignee_id: ID | null; created_by: ID | null; archived_at: string | null }>;
  projects: Record<ID, { id: ID; name: string; slug: string; archived_at: string | null }>;
  /** The members who have at least one device: nobody else is worth a message. */
  recipients: ID[];
}

const TITLE_MAX = 90;
const clip = (text: string, max = TITLE_MAX) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const quoted = (title: string) => `« ${clip(title)} »`;
const points = (n: number) => `${n.toLocaleString("fr-CA").replace(/\s/g, " ")} points`;

/** « A », « B » et 2 autres */
function listed(titles: string[]): string {
  const shown = titles.slice(0, 2).map((t) => quoted(clip(t, 48)));
  const rest = titles.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} et ${rest} ${rest > 1 ? "autres" : "autre"}` : shown.join(" et ");
}

interface TaskNews {
  event: PushEvent;
  kind: Exclude<PushKind, "tower_record">;
  task: PushContext["tasks"][ID];
  project: PushContext["projects"][ID];
  actor: PushContext["members"][ID];
}

/**
 * The task events of a batch that are still true and worth saying once: the
 * task and its project still stand, a status announced is the latest one, and a
 * task created then handed over in the same breath is one piece of news.
 */
function taskNews(events: PushEvent[], ctx: PushContext): TaskNews[] {
  const news: TaskNews[] = [];
  for (const event of events) {
    if (event.kind === "tower_record" || !event.task_id || !event.actor_id) continue;
    const task = ctx.tasks[event.task_id];
    const project = task ? ctx.projects[task.project_id] : undefined;
    const actor = ctx.members[event.actor_id];
    if (!task || !project || !actor || task.archived_at || project.archived_at) continue;
    news.push({ event, kind: event.kind, task, project, actor });
  }
  const created = new Set(news.filter((n) => n.kind === "task_created").map((n) => n.task.id));
  const latest = new Map<string, number>();
  for (const n of news) {
    // One slot for the status of a task (done or blocked: the last word counts), one for whose it is.
    const slot = `${n.kind === "task_done" || n.kind === "task_blocked" ? "status" : n.kind}:${n.task.id}`;
    latest.set(slot, Math.max(latest.get(slot) ?? 0, n.event.id));
  }
  return news.filter((n) => {
    const slot = `${n.kind === "task_done" || n.kind === "task_blocked" ? "status" : n.kind}:${n.task.id}`;
    if (latest.get(slot) !== n.event.id) return false;
    if (n.kind === "task_assigned") {
      // Created a moment ago: the creation already says whose it is. Handed over twice: only the person who has it now.
      if (created.has(n.task.id)) return false;
      if (n.event.detail.assignee_id !== n.task.assignee_id) return false;
    }
    return true;
  });
}

const taskUrl = (n: TaskNews) => `/projets/${n.project.slug}?tache=${n.task.id}`;

function oneTask(n: TaskNews, me: ID): PushMessage {
  const who = firstName(n.actor.full_name);
  const where = n.project.name;
  const tag = `${n.kind}:${n.task.id}`;
  const url = taskUrl(n);
  if (n.kind === "task_assigned" || (n.kind === "task_created" && n.task.assignee_id === me)) {
    return { title: `${who} vous confie une tâche`, body: `${clip(n.task.title)} · ${where}`, url, tag };
  }
  if (n.kind === "task_created") {
    return { title: `Nouvelle tâche · ${where}`, body: `${who} a créé ${quoted(n.task.title)}.`, url, tag };
  }
  if (n.kind === "task_done") {
    return { title: "Tâche terminée", body: `${who} a terminé ${quoted(n.task.title)} · ${where}`, url, tag };
  }
  return { title: "Tâche bloquée", body: `${who} signale un blocage : ${quoted(n.task.title)} · ${where}`, url, tag };
}

/** Several pieces of news of the same kind, for the same person, in one message. */
function manyTasks(kind: TaskNews["kind"] | "for_me", items: TaskNews[]): PushMessage {
  const actors = new Set(items.map((n) => n.actor.id));
  const who = actors.size === 1 ? firstName(items[0].actor.full_name) : null;
  const titles = listed(items.map((n) => n.task.title));
  const tag = `${kind}:lot:${items[0].event.id}`;
  if (kind === "for_me") {
    return { title: who ? `${who} vous confie ${items.length} tâches` : `${items.length} tâches vous sont confiées`, body: titles, url: "/mes-taches", tag };
  }
  if (kind === "task_created") {
    return { title: `${items.length} nouvelles tâches`, body: who ? `${who} : ${titles}` : titles, url: "/", tag };
  }
  if (kind === "task_done") {
    return { title: `${items.length} tâches terminées`, body: who ? `${who} : ${titles}` : titles, url: "/", tag };
  }
  return { title: `${items.length} tâches bloquées`, body: who ? `${who} : ${titles}` : titles, url: "/", tag };
}

function towerMessage(event: PushEvent, ctx: PushContext, me: ID): PushMessage | null {
  const actor = event.actor_id ? ctx.members[event.actor_id] : undefined;
  const score = Number(event.detail.score);
  if (!actor || !Number.isFinite(score) || score <= 0) return null;
  const who = firstName(actor.full_name);
  const holder = (key: string) => (typeof event.detail[key] === "string" ? (event.detail[key] as string) : null);
  let body: string;
  if (event.detail.all_time === true) {
    // The record of all time is the bigger news: it is said alone, even when the week's lead changed with it.
    const record = holder("all_time_member_id");
    body =
      record === me
        ? `${who} vient de détruire ton record de tous les temps 🍅 ${points(score)}. À toi de jouer.`
        : `${who} bat le record de tous les temps : ${points(score)}.`;
  } else {
    const previous = holder("previous_member_id");
    body =
      previous === me
        ? `${who} vient de détruire ton record 🍅 ${points(score)}. À toi de jouer.`
        : previous
          ? `${who} prend la tête de la semaine : ${points(score)}.`
          : `${who} ouvre la semaine : ${points(score)}. Qui dit mieux ?`;
  }
  return { title: "Tomato Tower", body, url: "/arcade", tag: "tower_record" };
}

/**
 * Who receives what, from a batch of outbox rows.
 *
 * Nobody is told about their own doing. A member's switches and scope decide
 * the rest; a task handed to someone is always for that person (it is their
 * work now), under the « Nouvelle tâche » switch. Several pieces of news of the
 * same kind become one message.
 */
export function planPush(events: PushEvent[], ctx: PushContext): Map<ID, PushMessage[]> {
  const out = new Map<ID, PushMessage[]>();
  const sorted = [...events].sort((a, b) => a.id - b.id);
  const news = taskNews(sorted, ctx);
  // Of several changes of lead in one batch, only the last is still true.
  const record = sorted.filter((e) => e.kind === "tower_record").at(-1);

  for (const me of ctx.recipients) {
    if (!ctx.members[me]?.active) continue;
    const prefs = ctx.prefs[me] ?? DEFAULT_PUSH_PREFS;
    const messages: PushMessage[] = [];
    const mine = (n: TaskNews) => n.task.assignee_id === me || n.task.created_by === me;
    const heard = news.filter((n) => n.actor.id !== me);

    // Work that lands on me: created for me, or handed to me afterwards.
    const forMe = prefs.task_created
      ? heard.filter((n) => (n.kind === "task_assigned" || n.kind === "task_created") && n.task.assignee_id === me)
      : [];
    if (forMe.length === 1) messages.push(oneTask(forMe[0], me));
    else if (forMe.length > 1) messages.push(manyTasks("for_me", forMe));

    const groups: [TaskNews["kind"], boolean][] = [
      ["task_created", prefs.task_created],
      ["task_done", prefs.task_done],
      ["task_blocked", prefs.task_blocked],
    ];
    for (const [kind, wanted] of groups) {
      if (!wanted) continue;
      const items = heard.filter((n) => n.kind === kind && !forMe.includes(n) && (prefs.scope === "team" || mine(n)));
      if (items.length === 1) messages.push(oneTask(items[0], me));
      else if (items.length > 1) messages.push(manyTasks(kind, items));
    }

    if (record && prefs.tower_record && record.actor_id !== me) {
      const message = towerMessage(record, ctx, me);
      if (message) messages.push(message);
    }
    if (messages.length) out.set(me, messages);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* In the browser                                                      */
/* ------------------------------------------------------------------ */

/** Why notifications cannot be turned on here, when they cannot. */
export type PushSupport = "ok" | "ios-install" | "unsupported";

/** What this browser can do. On an iPhone or an iPad, only the installed app receives notifications. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const able = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (able) return "ok";
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return apple && !installed ? "ios-install" : "unsupported";
}

/** A short name for this device, as its owner would call it. */
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || touchMac) return "iPad";
  const system = /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return [system, browser].filter(Boolean).join(" · ");
}

/** The server's public key, in the form `pushManager.subscribe` takes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
