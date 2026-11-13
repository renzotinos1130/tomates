import type { ChatConversation, ChatMessage, Meeting, Member, RowOf, Snapshot, TableName, TaskEvent } from "../types";

/**
 * Persistence boundary. The UI never talks to Supabase (or localStorage)
 * directly: it goes through the store, which goes through an adapter.
 *
 *  - `SupabaseAdapter`: Postgres + RLS + Realtime (production).
 *  - `DemoAdapter`: in-browser database persisted in localStorage and
 *    synchronised between tabs (design review / demos, no backend needed).
 */

export type Change =
  | { table: TableName; type: "upsert"; row: RowOf<TableName> }
  | { table: TableName; type: "delete"; key: string };

export interface PresenceState {
  member_id: string;
  /** Pathname the member is looking at (e.g. `/meeting`). */
  page: string;
  at: number;
}

export interface PresenceHandle {
  update(state: PresenceState): void;
  leave(): void;
}

/** An account the super administrator creates for someone, with a password to hand over. */
export interface NewAccount {
  email: string;
  fullName: string;
  role: "member" | "admin";
  password: string;
}

export type AccountOutcome<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface DataAdapter {
  readonly mode: "demo" | "supabase";
  load(): Promise<Snapshot>;
  /** Full history of one task (the initial load only keeps recent events). */
  loadTaskEvents(taskId: string): Promise<TaskEvent[]>;
  subscribe(onChange: (change: Change) => void, onResync?: () => void): () => void;
  joinPresence(state: PresenceState, onSync: (states: PresenceState[]) => void): PresenceHandle;
  insert<T extends TableName>(table: T, row: RowOf<T>): Promise<RowOf<T>>;
  update<T extends TableName>(table: T, key: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>>;
  remove(table: TableName, key: string): Promise<void>;
  /**
   * Creates the meeting of a week unless a teammate already did (one meeting
   * per week): returns whichever row exists afterwards.
   */
  ensureMeeting(row: Meeting): Promise<Meeting>;
  /**
   * Opens the direct conversation between two members unless it already exists
   * (one per pair): returns whichever row exists afterwards.
   */
  openDirect(row: ChatConversation): Promise<ChatConversation>;
  /** Older messages of one conversation (the initial load only keeps the recent ones). */
  loadChatMessages(conversationId: string, before: string, limit: number): Promise<ChatMessage[]>;
  /** Creates a member with a temporary password (the server checks that a super administrator asks). */
  createAccount(input: NewAccount): Promise<AccountOutcome<{ member: Member }>>;
  /** Sets a new temporary password for a member, who must then change it. */
  setMemberPassword(memberId: string, password: string): Promise<AccountOutcome>;
}

/** Primary key of a row, as a string (composite keys are joined with `:`). */
export function rowKey(table: TableName, row: Record<string, unknown>): string {
  if (table === "meeting_priorities") return `${row.meeting_id}:${row.task_id}`;
  if (table === "chat_participants") return `${row.conversation_id}:${row.member_id}`;
  if (table === "invites") return String(row.email);
  return String(row.id);
}

export const TABLES: TableName[] = [
  "members",
  "invites",
  "projects",
  "tasks",
  "subtasks",
  "comments",
  "task_events",
  "meetings",
  "meeting_items",
  "meeting_priorities",
  "workflows",
  "chat_conversations",
  "chat_participants",
  "chat_messages",
];
