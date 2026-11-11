"use client";

/**
 * Production adapter: Postgres (via PostgREST) + Realtime.
 * Every query runs with the signed-in user's JWT, so Row Level Security
 * decides what can be read or written — the client is never trusted.
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Meeting, RowOf, Snapshot, TableName, TaskEvent } from "../types";
import { getSupabaseBrowserClient } from "../supabase/client";
import { rowKey, TABLES, type Change, type DataAdapter, type PresenceState } from "./adapter";

const DB_TABLE: Record<TableName, string> = {
  members: "members",
  invites: "member_invites",
  projects: "projects",
  tasks: "tasks",
  subtasks: "subtasks",
  comments: "comments",
  task_events: "task_events",
  meetings: "meetings",
  meeting_items: "meeting_items",
  meeting_priorities: "meeting_priorities",
};
const FROM_DB = Object.fromEntries(Object.entries(DB_TABLE).map(([k, v]) => [v, k])) as Record<string, TableName>;

/** Columns computed by triggers / defaults: never sent by the client. */
const SERVER_MANAGED: Partial<Record<TableName, string[]>> = {
  tasks: ["created_at", "updated_at", "status_changed_at", "completed_at"],
  comments: ["created_at", "updated_at"],
  subtasks: ["created_at"],
  meetings: ["created_at"],
  meeting_items: ["created_at"],
  meeting_priorities: ["created_at"],
  projects: ["created_at"],
};

const UPSERT_ON: Partial<Record<TableName, string>> = {
  meeting_priorities: "meeting_id,task_id",
  invites: "email",
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

  async load(): Promise<Snapshot> {
    const entries = await Promise.all(
      TABLES.map(async (t) => [t, t === "task_events" ? await this.recentEvents() : await this.fetchAll(t)] as const),
    );
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
}
