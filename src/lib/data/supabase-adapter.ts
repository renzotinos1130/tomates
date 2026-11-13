"use client";

/**
 * Production adapter: Postgres (via PostgREST) + Realtime.
 * Every query runs with the signed-in user's JWT, so Row Level Security
 * decides what can be read or written — the client is never trusted.
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { CHAT_RECENT } from "../chat";
import type { ChatConversation, ChatMessage, Meeting, Member, RowOf, Snapshot, TableName, TaskEvent } from "../types";
import { getSupabaseBrowserClient } from "../supabase/client";
import { createAccount, setAccountPassword } from "../server/accounts";
import { finishTowerRun, placeTeamCrate, startTowerRun } from "../server/tower";
import type { TeamPlace, TeamTowerView, TowerBoards, TowerFinish, TowerStart } from "../tower/boards";
import { rowKey, TABLES, type AccountOutcome, type Change, type DataAdapter, type FileUpload, type NewAccount, type PresenceState } from "./adapter";
import { removeFromStorage, storageUrl, uploadToStorage } from "./supabase-files";

const DB_TABLE: Record<TableName, string> = {
  members: "members",
  invites: "member_invites",
  projects: "projects",
  tasks: "tasks",
  subtasks: "subtasks",
  comments: "comments",
  attachments: "task_attachments",
  task_events: "task_events",
  meetings: "meetings",
  meeting_items: "meeting_items",
  meeting_priorities: "meeting_priorities",
  workflows: "workflows",
  chat_conversations: "chat_conversations",
  chat_participants: "chat_participants",
  chat_messages: "chat_messages",
};
const FROM_DB = Object.fromEntries(Object.entries(DB_TABLE).map(([k, v]) => [v, k])) as Record<string, TableName>;

/** Columns computed by triggers / defaults: never sent by the client. */
const SERVER_MANAGED: Partial<Record<TableName, string[]>> = {
  tasks: ["created_at", "updated_at", "status_changed_at", "completed_at"],
  comments: ["created_at", "updated_at"],
  attachments: ["created_at"],
  subtasks: ["created_at"],
  meetings: ["created_at"],
  meeting_items: ["created_at"],
  meeting_priorities: ["created_at"],
  projects: ["created_at"],
  workflows: ["created_at", "updated_at", "updated_by"],
  chat_messages: ["created_at"],
};

const UPSERT_ON: Partial<Record<TableName, string>> = {
  meeting_priorities: "meeting_id,task_id",
  invites: "email",
  // "Read up to here" is recorded again and again: the row is created once, then moved.
  chat_participants: "conversation_id,member_id",
};

const RECENT_EVENTS = 1500;
const PAGE = 1000;

function strip<T extends Record<string, unknown>>(table: TableName, row: T): T {
  const drop = SERVER_MANAGED[table];
  if (!drop) return row;
  const copy = { ...row };
  for (const k of drop) delete copy[k];
  return copy;
}

function keyFilter(table: TableName, key: string): Record<string, string> {
  if (table === "meeting_priorities") {
    const [meeting_id, task_id] = key.split(":");
    return { meeting_id, task_id };
  }
  if (table === "chat_participants") {
    const [conversation_id, member_id] = key.split(":");
    return { conversation_id, member_id };
  }
  if (table === "invites") return { email: key };
  return { id: key };
}

function friendly(error: { message?: string; code?: string } | null): Error {
  const msg = error?.message ?? "Erreur inconnue";
  if (error?.code === "42501" || /row-level security/i.test(msg))
    return new Error("Action refusée : vous n'avez pas les droits nécessaires.");
  if (/Failed to fetch|NetworkError/i.test(msg)) return new Error("Connexion perdue — réessayez dans un instant.");
  return new Error(msg);
}

export class SupabaseAdapter implements DataAdapter {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient = getSupabaseBrowserClient();
  private channel: RealtimeChannel | null = null;
  /** The newest instant seen in the chat messages last loaded: where a catch-up starts from. */
  private chatWatermark: string | null = null;
  private catchingUp = false;

  async load(): Promise<Snapshot> {
    const fetch = (t: TableName) =>
      t === "task_events" ? this.recentEvents() : t === "chat_messages" ? this.recentMessages() : this.fetchAll(t);
    const entries = await Promise.all(TABLES.map(async (t) => [t, await fetch(t)] as const));
    return Object.fromEntries(entries) as unknown as Snapshot;
  }

  private async fetchAll(table: TableName) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb
        .from(DB_TABLE[table])
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) {
        // Non-admins cannot read invites: that's expected, not an error.
        if (table === "invites") return [];
        throw friendly(error);
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  }

  private async recentEvents() {
    const { data, error } = await this.sb
      .from("task_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(RECENT_EVENTS);
    if (error) throw friendly(error);
    return data ?? [];
  }

  /**
   * The latest messages of each conversation (not of the busiest one): every
   * thread opens on its recent part. Read page by page, the API caps a response.
   */
  private async recentMessages() {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb
        .rpc("chat_recent_messages", { p_per_conversation: CHAT_RECENT })
        .order("conversation_id")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw friendly(error);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    let mark: string | null = null;
    for (const m of rows as ChatMessage[]) {
      if (!mark || m.created_at > mark) mark = m.created_at;
      if (m.deleted_at && m.deleted_at > mark) mark = m.deleted_at;
    }
    this.chatWatermark = mark;
    return rows;
  }

  /**
   * Realtime only starts flowing a moment after the load. Whatever was written
   * (or deleted) in between is fetched once it does: in a chat, a message that
   * never shows up is the one failure nobody forgives.
   */
  private async catchUpChat(onChange: (c: Change) => void) {
    if (this.catchingUp) return;
    this.catchingUp = true;
    try {
      const since = this.chatWatermark;
      let recent = this.sb.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(200);
      if (since) recent = recent.or(`created_at.gt."${since}",deleted_at.gt."${since}"`);
      const [messages, conversations] = await Promise.all([recent, this.sb.from("chat_conversations").select("*")]);
      // Not worth an error: the next reload of the workspace catches up.
      if (messages.error || conversations.error) return;
      for (const row of conversations.data as ChatConversation[]) onChange({ table: "chat_conversations", type: "upsert", row });
      for (const row of messages.data as ChatMessage[]) onChange({ table: "chat_messages", type: "upsert", row });
    } finally {
      this.catchingUp = false;
    }
  }

  async loadChatMessages(conversationId: string, before: string, limit: number): Promise<ChatMessage[]> {
    const { data, error } = await this.sb
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw friendly(error);
    return (data ?? []) as ChatMessage[];
  }

  async openDirect(row: ChatConversation): Promise<ChatConversation> {
    // The server decides everything (id, order of the pair, creator): it only needs the other person.
    const other = row.member_a === row.created_by ? row.member_b : row.member_a;
    const { data, error } = await this.sb.rpc("chat_open_direct", { p_other: other });
    if (error) throw friendly(error);
    return data as ChatConversation;
  }

  // Accounts and passwords are not written from the browser: these run on the server, with the
  // service key, after checking that a super administrator asks (see lib/server/accounts.ts).
  createAccount(input: NewAccount): Promise<AccountOutcome<{ member: Member }>> {
    return createAccount(input);
  }

  setMemberPassword(memberId: string, password: string): Promise<AccountOutcome> {
    return setAccountPassword({ memberId, password });
  }

  async loadTaskEvents(taskId: string): Promise<TaskEvent[]> {
    const { data, error } = await this.sb.from("task_events").select("*").eq("task_id", taskId);
    if (error) throw friendly(error);
    return (data ?? []) as TaskEvent[];
  }

  subscribe(onChange: (c: Change) => void, onResync?: () => void): () => void {
    let wasSubscribed = false;
    const channel = this.sb.channel("db-changes");
    for (const t of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: DB_TABLE[t] }, (payload) => {
        const table = FROM_DB[payload.table];
        if (!table) return;
        if (payload.eventType === "DELETE") {
          const old = payload.old as Record<string, unknown>;
          onChange({ table, type: "delete", key: rowKey(table, old) });
        } else {
          onChange({ table, type: "upsert", row: payload.new as RowOf<TableName> });
        }
      });
    }
    // The server announces when database changes really start to flow.
    channel.on("system", {}, (payload: { extension?: string; status?: string }) => {
      if (payload?.extension === "postgres_changes" && payload.status === "ok") void this.catchUpChat(onChange);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // After a reconnection, re-read everything we may have missed.
        if (wasSubscribed) onResync?.();
        wasSubscribed = true;
      }
    });
    this.channel = channel;
    return () => {
      void this.sb.removeChannel(channel);
      this.channel = null;
    };
  }

  joinPresence(state: PresenceState, onSync: (states: PresenceState[]) => void) {
    const ch = this.sb.channel("presence:hq", { config: { presence: { key: state.member_id } } });
    let current = state;
    ch.on("presence", { event: "sync" }, () => {
      const raw = ch.presenceState<PresenceState>();
      const latest = new Map<string, PresenceState>();
      for (const metas of Object.values(raw)) {
        for (const m of metas) {
          const prev = latest.get(m.member_id);
          if (!prev || prev.at < m.at) latest.set(m.member_id, m);
        }
      }
      onSync([...latest.values()]);
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track(current);
    });
    return {
      update: (s: PresenceState) => {
        current = s;
        void ch.track(s);
      },
      leave: () => {
        void ch.untrack();
        void this.sb.removeChannel(ch);
      },
    };
  }

  async insert<T extends TableName>(table: T, row: RowOf<T>): Promise<RowOf<T>> {
    const payload = strip(table, row as unknown as Record<string, unknown>);
    const from = this.sb.from(DB_TABLE[table]);
    // Two people can star the same task or invite the same person at once:
    // those inserts are idempotent instead of failing on the primary key.
    const conflict = UPSERT_ON[table];
    const query = conflict ? from.upsert(payload, { onConflict: conflict }) : from.insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw friendly(error);
    return data as RowOf<T>;
  }

  async ensureMeeting(row: Meeting): Promise<Meeting> {
    const payload = strip("meetings", row as unknown as Record<string, unknown>);
    const { error } = await this.sb
      .from("meetings")
      .upsert(payload, { onConflict: "week_start", ignoreDuplicates: true });
    if (error) throw friendly(error);
    const { data, error: readError } = await this.sb
      .from("meetings")
      .select("*")
      .eq("week_start", row.week_start)
      .single();
    if (readError) throw friendly(readError);
    return data as Meeting;
  }

  async update<T extends TableName>(table: T, key: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>> {
    const { data, error } = await this.sb
      .from(DB_TABLE[table])
      .update(strip(table, patch as unknown as Record<string, unknown>))
      .match(keyFilter(table, key))
      .select()
      .single();
    if (error) throw friendly(error);
    return data as RowOf<T>;
  }

  async remove(table: TableName, key: string): Promise<void> {
    const { error } = await this.sb.from(DB_TABLE[table]).delete().match(keyFilter(table, key));
    if (error) throw friendly(error);
  }

  uploadFile(upload: FileUpload): Promise<void> {
    return uploadToStorage(this.sb, upload);
  }

  fileUrl(path: string, download?: string): Promise<string> {
    return storageUrl(this.sb, path, download);
  }

  removeFiles(paths: string[]): Promise<void> {
    return removeFromStorage(this.sb, paths);
  }

  towerStart(): Promise<TowerStart> {
    return startTowerRun();
  }

  towerFinish(runId: string, drops: number[]): Promise<TowerFinish> {
    return finishTowerRun({ runId, drops });
  }

  async towerBoards(): Promise<TowerBoards> {
    const { data, error } = await this.sb.rpc("tower_boards");
    if (error || !data) throw friendly(error);
    return data as TowerBoards;
  }

  async towerTeam(): Promise<TeamTowerView> {
    const { data, error } = await this.sb.rpc("tower_team_view");
    if (error || !data) throw friendly(error);
    return data as TeamTowerView;
  }

  async towerTeamPlace(towerId: string, floor: number, tick: number): Promise<TeamPlace> {
    const out = await placeTeamCrate({ towerId, floor, tick });
    // Whatever happened, the tower is shown as the database has it now.
    const view = await this.towerTeam().catch(() => undefined);
    if (out.ok) {
      if (!view) throw new Error("Connexion perdue — réessayez dans un instant.");
      return { ok: true, kind: out.kind, view };
    }
    if (out.reason === "moved" && view) return { ok: false, reason: "moved", view };
    return { ok: false, reason: out.reason === "moved" ? "error" : out.reason, error: out.error, view };
  }

  subscribeTower(onChange: () => void): () => void {
    const channel = this.sb.channel("tower-changes");
    for (const table of ["tower_runs", "tower_team_towers", "tower_team_crates"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange());
    }
    channel.subscribe();
    return () => {
      void this.sb.removeChannel(channel);
    };
  }
}
