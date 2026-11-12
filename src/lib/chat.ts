/**
 * Chat — pure, framework-free rules shared by the store, the adapters and the
 * screens: who sees a conversation, what is unread, how a thread is laid out.
 */
import { format, isSameDay, subDays } from "date-fns";
import { capitalize, formatLongDate, formatShortDate, locale } from "./dates";
import type { ChatConversation, ChatMessage, ChatParticipant, ID, Member, Timestamp } from "./types";

/** Where the chat lives. `/messages/<id>` opens one conversation. */
export const CHAT_PATH = "/messages";
export const chatHref = (conversationId: ID) => `${CHAT_PATH}/${conversationId}`;

/**
 * The page a member is on, as the rest of the team is told (presence). Inside
 * the messages it stops at `/messages`: two people shown on the same
 * conversation address would tell everyone who is writing to whom.
 */
export const presencePath = (pathname: string) => (pathname.startsWith(`${CHAT_PATH}/`) ? CHAT_PATH : pathname);

/** The team channel. The migration (and the demo seed) create it with this id. */
export const GENERAL_CHANNEL_ID = "c0000000-0000-4000-8000-000000000001";

/** Same limit as the database. */
export const CHAT_BODY_MAX = 4000;

/**
 * Loading the workspace brings the latest messages of EACH conversation (a
 * plain "latest N" would be eaten by the busiest one); older ones are fetched
 * per conversation, on demand. Unread badges stop at « 99+ », so a window of
 * 100 is enough to count them right.
 */
export const CHAT_RECENT = 100;
export const CHAT_PAGE = 200;

/** Newest first; the id settles two messages of the same instant, as the database does. */
const newestFirst = (a: ChatMessage, b: ChatMessage) =>
  a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;

/** The latest `limit` messages of each conversation: what a load returns. */
export function recentPerConversation(messages: ChatMessage[], limit = CHAT_RECENT): ChatMessage[] {
  const taken = new Map<ID, number>();
  return [...messages].sort(newestFirst).filter((m) => {
    const n = taken.get(m.conversation_id) ?? 0;
    taken.set(m.conversation_id, n + 1);
    return n < limit;
  });
}

/**
 * What the app holds after a (re)load. `fresh` is the latest window of each
 * conversation; the workspace is re-read every time the tab comes back, and the
 * older pages a thread had fetched must not vanish under the reader. They are
 * kept only while they still connect to the fresh window — after a long absence
 * (more new messages than a window) there would be a hole in the thread, so it
 * starts again from its recent part.
 *
 * `hasOlder[id]`: this conversation has messages on the server that are not held.
 */
export function mergeLoadedMessages(
  fresh: ChatMessage[],
  held: Record<ID, ChatMessage>,
  hadOlder: Record<ID, boolean>,
  window = CHAT_RECENT,
): { messages: Record<ID, ChatMessage>; hasOlder: Record<ID, boolean> } {
  const messages: Record<ID, ChatMessage> = {};
  const count = new Map<ID, number>();
  const edge = new Map<ID, ChatMessage>();
  for (const m of fresh) {
    messages[m.id] = m;
    count.set(m.conversation_id, (count.get(m.conversation_id) ?? 0) + 1);
    const oldest = edge.get(m.conversation_id);
    if (!oldest || newestFirst(oldest, m) < 0) edge.set(m.conversation_id, m);
  }
  const hasOlder: Record<ID, boolean> = {};
  const connected = new Set<ID>();
  for (const [id, n] of count) {
    // A window that is not full is the whole conversation.
    if (n < window) continue;
    if (held[edge.get(id)!.id]) {
      connected.add(id);
      hasOlder[id] = hadOlder[id] === true;
    } else {
      hasOlder[id] = true;
    }
  }
  for (const m of Object.values(held)) {
    if (!connected.has(m.conversation_id) || messages[m.id]) continue;
    if (newestFirst(edge.get(m.conversation_id)!, m) < 0) messages[m.id] = m;
  }
  return { messages, hasOlder };
}

/** Messages of one conversation older than `before`, newest first: one more page of a thread. */
export function olderMessages(messages: ChatMessage[], conversationId: ID, before: Timestamp, limit = CHAT_PAGE): ChatMessage[] {
  return messages
    .filter((m) => m.conversation_id === conversationId && m.created_at < before)
    .sort(newestFirst)
    .slice(0, limit);
}

/** The two members of a direct conversation, smallest id first — the order the database enforces. */
export function directPair(a: ID, b: ID): [ID, ID] {
  return a < b ? [a, b] : [b, a];
}

/** A channel is everyone's; a direct conversation belongs to its two members. Mirrors the SELECT policy. */
export function canSeeConversation(c: ChatConversation, meId: ID | null): boolean {
  if (c.kind === "channel") return true;
  return !!meId && (c.member_a === meId || c.member_b === meId);
}

export function otherMemberId(c: ChatConversation, meId: ID | null): ID | null {
  if (c.kind !== "direct") return null;
  return c.member_a === meId ? c.member_b : c.member_a;
}

export function findDirect(conversations: ChatConversation[], a: ID, b: ID): ChatConversation | null {
  const [x, y] = directPair(a, b);
  return conversations.find((c) => c.kind === "direct" && c.member_a === x && c.member_b === y) ?? null;
}

export const participantKey = (conversationId: ID, memberId: ID) => `${conversationId}:${memberId}`;

/** A message somebody else wrote after I last read the conversation. Deleted messages never count. */
export function isUnread(m: ChatMessage, lastReadAt: Timestamp | null, meId: ID | null): boolean {
  if (m.deleted_at || m.author_id === meId) return false;
  return !lastReadAt || m.created_at > lastReadAt;
}

/**
 * Where my reading of a conversation stands: my last position or, if I never
 * opened it, the day I joined the team — what was said before I arrived is
 * history, not a pile of unread messages.
 */
export function readPosition(position: ChatParticipant | undefined, me: Member | undefined): Timestamp | null {
  return position?.last_read_at ?? me?.created_at ?? null;
}

export interface ConversationView {
  conversation: ChatConversation;
  /** Direct conversation: the other person (null if they are no longer in the team). */
  other: Member | null;
  title: string;
  /** Most recent message, deleted or not. */
  last: ChatMessage | null;
  /** When the conversation last moved: its last message, or its creation. */
  lastAt: Timestamp;
  unread: number;
}

/**
 * The conversations of one member, as the list shows them: channels first
 * (« Général » on top), then direct conversations, most recent first. A direct
 * conversation nobody has written in yet stays out of the list — opening one
 * creates it, and an empty thread should not appear on the other person's side.
 */
export function conversationViews(input: {
  conversations: ChatConversation[];
  messages: ChatMessage[];
  participants: ChatParticipant[];
  members: Record<ID, Member>;
  meId: ID | null;
  /** Conversation being looked at: listed even when it is still empty. */
  keepId?: ID | null;
}): ConversationView[] {
  const { conversations, messages, participants, members, meId, keepId } = input;
  const me = meId ? members[meId] : undefined;
  const mine = new Map<ID, ChatParticipant>();
  for (const p of participants) if (p.member_id === meId) mine.set(p.conversation_id, p);

  const last = new Map<ID, ChatMessage>();
  const unread = new Map<ID, number>();
  for (const m of messages) {
    const prev = last.get(m.conversation_id);
    if (!prev || prev.created_at < m.created_at) last.set(m.conversation_id, m);
    if (isUnread(m, readPosition(mine.get(m.conversation_id), me), meId)) {
      unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
    }
  }

  const views: ConversationView[] = [];
  for (const c of conversations) {
    if (!canSeeConversation(c, meId)) continue;
    const lastMessage = last.get(c.id) ?? null;
    if (c.kind === "direct" && !lastMessage && c.id !== keepId) continue;
    const otherId = otherMemberId(c, meId);
    const other = otherId ? (members[otherId] ?? null) : null;
    views.push({
      conversation: c,
      other,
      title: c.kind === "channel" ? (c.name ?? "Canal") : (other?.full_name ?? "Ancien membre"),
      last: lastMessage,
      lastAt: lastMessage?.created_at ?? c.created_at,
      unread: unread.get(c.id) ?? 0,
    });
  }
  const rank = (v: ConversationView) => (v.conversation.id === GENERAL_CHANNEL_ID ? 0 : v.conversation.kind === "channel" ? 1 : 2);
  return views.sort((a, b) => rank(a) - rank(b) || (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}

/* ------------------------------------------------------------------ */
/* Thread layout                                                       */
/* ------------------------------------------------------------------ */

/** Two messages of the same person, minutes apart, read as one block. */
const GROUP_WINDOW_MS = 5 * 60_000;

export type ThreadItem =
  /** `fresh`: what is new starts with this day — the separator says both at once. */
  | { type: "day"; key: string; label: string; fresh: boolean }
  | { type: "unread"; key: string }
  | {
      type: "message";
      key: string;
      message: ChatMessage;
      mine: boolean;
      /** First message of a block: shows who is talking and when. */
      head: boolean;
      /** Last message of a block: closes the bubble group. */
      tail: boolean;
    };

/**
 * Lays a conversation out: a separator per day, messages of the same author
 * grouped, and one « Nouveaux messages » divider above the first message that
 * arrived after `readUpTo` (the position when the thread was opened).
 */
export function threadItems(messages: ChatMessage[], meId: ID | null, readUpTo: Timestamp | null, now: Date): ThreadItem[] {
  const sorted = [...messages].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  const items: ThreadItem[] = [];
  let prev: ChatMessage | null = null;
  let divided = false;
  for (const m of sorted) {
    const at = new Date(m.created_at);
    const newDay = !prev || !isSameDay(new Date(prev.created_at), at);
    let fresh = false;
    // Never above the first message of the thread: there is nothing "already read" to set it apart from.
    if (!divided && readUpTo && isUnread(m, readUpTo, meId)) {
      divided = true;
      fresh = !!prev;
    }
    if (newDay) items.push({ type: "day", key: `day-${m.id}`, label: dayLabel(at, now), fresh });
    else if (fresh) items.push({ type: "unread", key: `unread-${m.id}` });
    const grouped =
      !!prev &&
      !newDay &&
      !fresh &&
      prev.author_id === m.author_id &&
      at.getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
    if (grouped) {
      const before = items[items.length - 1];
      if (before.type === "message") before.tail = false;
    }
    items.push({ type: "message", key: m.id, message: m, mine: !!meId && m.author_id === meId, head: !grouped, tail: true });
    prev = m;
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Wording                                                             */
/* ------------------------------------------------------------------ */

/** « 9 h 05 » — the way the rest of the app writes a time. */
export function formatClock(ts: Timestamp | Date): string {
  return format(typeof ts === "string" ? new Date(ts) : ts, "H 'h' mm", { locale });
}

/** The day before `now` (the clock the screens tick on, not the system's at the moment of the call). */
const isDayBefore = (d: Date, now: Date) => isSameDay(d, subDays(now, 1));

export function dayLabel(d: Date, now: Date): string {
  if (isSameDay(d, now)) return "Aujourd'hui";
  if (isDayBefore(d, now)) return "Hier";
  const label = capitalize(formatLongDate(d));
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

/** Compact time for the conversation list: the hour today, then « Hier », the weekday, the date. */
export function listTime(ts: Timestamp, now: Date): string {
  const d = new Date(ts);
  if (isSameDay(d, now)) return formatClock(d);
  if (isDayBefore(d, now)) return "Hier";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return format(d, "EEE", { locale }).replace(".", "");
  return formatShortDate(d);
}

/** One line for the list: who said what last. */
export function previewText(view: ConversationView, meId: ID | null, members: Record<ID, Member>): string {
  const m = view.last;
  if (!m) return view.conversation.kind === "channel" ? "Le canal de toute l'équipe." : "Aucun message pour l'instant.";
  const text = m.deleted_at ? "Message supprimé" : m.body.replace(/\s+/g, " ").trim();
  if (m.author_id === meId) return `Vous : ${text}`;
  if (view.conversation.kind === "channel") {
    const author = m.author_id ? members[m.author_id] : null;
    const first = author ? author.full_name.trim().split(/\s+/)[0] : "Ancien membre";
    return `${first} : ${text}`;
  }
  return text;
}
