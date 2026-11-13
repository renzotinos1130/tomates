import type { TeamPlace, TeamTowerView, TowerBoards, TowerFinish, TowerStart } from "../tower/boards";
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

/** Bytes on their way to the store of files. */
export interface FileUpload {
  /** Where they go: `<task id>/<attachment id>/<plain name>`. */
  path: string;
  file: Blob;
  contentType: string;
  onProgress?: (sent: number, total: number) => void;
  /** Aborting it stops the upload and leaves nothing behind. */
  signal?: AbortSignal;
}

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
  /** Changes the address a member signs in with (the server checks that a super administrator asks). */
  setMemberEmail(memberId: string, email: string): Promise<AccountOutcome<{ member: Member }>>;
  /**
   * Stores the bytes of a file (the row that describes it is an ordinary insert, made once
   * this resolves). Rejects with a sentence for the member; an aborted upload rejects too.
   */
  uploadFile(upload: FileUpload): Promise<void>;
  /** A temporary address for stored bytes: to show them, or with `download`, to save them under that name. */
  fileUrl(path: string, download?: string): Promise<string>;
  /** Removes stored bytes. What is already gone is not an error. */
  removeFiles(paths: string[]): Promise<void>;

  /* Tomato Tower. Scores and crates are written by the server (or, in the demo, by the same rules here). */

  /** Opens a run: the seed it is played with comes from the server. */
  towerStart(): Promise<TowerStart>;
  /** Hands over the log of a run (the tick each crate was let go at); the server replays it and counts. */
  towerFinish(runId: string, drops: number[]): Promise<TowerFinish>;
  /** This week's board, the board of all time, my figures, the past champions. */
  towerBoards(): Promise<TowerBoards>;
  /** The tower the team builds together, as it is now. */
  towerTeam(): Promise<TeamTowerView>;
  /** Places my crate of the day on it, let go at `tick`. */
  towerTeamPlace(towerId: string, floor: number, tick: number): Promise<TeamPlace>;
  /** Calls back when a score or a crate changes anywhere in the team. Returns how to stop listening. */
  subscribeTower(onChange: () => void): () => void;
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
  "attachments",
  "task_events",
  "meetings",
  "meeting_items",
  "meeting_priorities",
  "workflows",
  "chat_conversations",
  "chat_participants",
  "chat_messages",
];
