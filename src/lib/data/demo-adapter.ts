/**
 * Demo adapter — a tiny in-browser database.
 *
 * - Persists to localStorage, so refreshing the page keeps your changes.
 * - Emulates the Postgres triggers (derived task fields + history events).
 * - Synchronises every open tab through BroadcastChannel, including
 *   presence, so the "several people at once" experience can be tested
 *   with two windows side by side.
 */
import { diffTaskEvents, withDerivedFields } from "../task-logic";
import type { Comment, Meeting, RowOf, Snapshot, TableName, Task, TaskEvent, Workflow } from "../types";
import { uid } from "../utils";
import { rowKey, TABLES, type Change, type DataAdapter, type PresenceState } from "./adapter";
import { buildDemoSnapshot } from "./seed";

const STORAGE_KEY = "tthq:demo:db:v1";
const CHANNEL = "tthq:demo:sync";
const PRESENCE_CHANNEL = "tthq:demo:presence";

type Db = { [K in TableName]: Map<string, RowOf<K>> };

function emptyDb(): Db {
  return Object.fromEntries(TABLES.map((t) => [t, new Map()])) as unknown as Db;
}

function toDb(s: Snapshot): Db {
  const db = emptyDb();
  for (const t of TABLES) {
    for (const row of s[t] as RowOf<TableName>[]) {
      (db[t] as Map<string, RowOf<TableName>>).set(rowKey(t, row as never), row);
    }
  }
  return db;
}

function toSnapshot(db: Db): Snapshot {
  return Object.fromEntries(TABLES.map((t) => [t, [...db[t].values()]])) as unknown as Snapshot;
}

export class DemoAdapter implements DataAdapter {
  readonly mode = "demo" as const;
  private db: Db = emptyDb();
  private listeners = new Set<(c: Change) => void>();
  private channel: BroadcastChannel | null = null;

  constructor(private getActor: () => string | null) {}

  async load(): Promise<Snapshot> {
    let snapshot: Snapshot | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) snapshot = JSON.parse(raw) as Snapshot;
    } catch {
      snapshot = null;
    }
    if (!snapshot || !Array.isArray(snapshot.tasks)) {
      snapshot = buildDemoSnapshot();
    }
    // Forward-compat: make sure every table exists.
    for (const t of TABLES) if (!Array.isArray(snapshot[t])) (snapshot as unknown as Record<string, unknown[]>)[t] = [];
    this.db = toDb(snapshot);
    this.persist();
    this.ensureChannel();
    return toSnapshot(this.db);
  }

  /** Wipes local changes and restores fresh demo data (all tabs). */
  reset(): Snapshot {
    this.db = toDb(buildDemoSnapshot());
    this.persist();
    this.channel?.postMessage({ type: "reset" });
    return toSnapshot(this.db);
  }

  async loadTaskEvents(taskId: string): Promise<TaskEvent[]> {
    return [...this.db.task_events.values()].filter((e) => e.task_id === taskId);
  }

  subscribe(onChange: (c: Change) => void, onResync?: () => void): () => void {
    this.listeners.add(onChange);
    this.ensureChannel();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "reset") {
        this.reload();
        onResync?.();
      }
    };
    this.channel?.addEventListener("message", onMessage);
    return () => {
      this.listeners.delete(onChange);
      this.channel?.removeEventListener("message", onMessage);
    };
  }

  joinPresence(state: PresenceState, onSync: (states: PresenceState[]) => void) {
    const peers = new Map<string, PresenceState>();
    const tabId = uid();
    let current = state;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(PRESENCE_CHANNEL);
    } catch {
      ch = null;
    }
    const emit = () => {
      const now = Date.now();
      for (const [k, s] of peers) if (now - s.at > 12_000) peers.delete(k);
      peers.set(tabId, { ...current, at: now });
      // One entry per member (latest wins).
      const byMember = new Map<string, PresenceState>();
      for (const s of peers.values()) {
        const prev = byMember.get(s.member_id);
        if (!prev || prev.at < s.at) byMember.set(s.member_id, s);
      }
      onSync([...byMember.values()]);
    };
    const beat = () => {
      ch?.postMessage({ type: "beat", tabId, state: { ...current, at: Date.now() } });
      emit();
    };
    ch?.addEventListener("message", (e: MessageEvent) => {
      const { type, tabId: other, state: s } = e.data ?? {};
      if (type === "beat" && other !== tabId) {
        const isNew = !peers.has(other);
        peers.set(other, s);
        if (isNew) ch?.postMessage({ type: "beat", tabId, state: { ...current, at: Date.now() } });
        emit();
      } else if (type === "bye") {
        peers.delete(other);
        emit();
      }
    });
    beat();
    const interval = setInterval(beat, 4_000);
    return {
      update: (s: PresenceState) => {
        current = s;
        beat();
      },
      leave: () => {
        clearInterval(interval);
        ch?.postMessage({ type: "bye", tabId });
        ch?.close();
      },
    };
  }

  async insert<T extends TableName>(table: T, row: RowOf<T>): Promise<RowOf<T>> {
    const now = new Date().toISOString();
    const actor = this.getActor();
    const changes: Change[] = [];
    let stored = { ...row } as RowOf<T>;
    if (table === "tasks") {
      const t = withDerivedFields(null, stored as Task, now);
      stored = t as RowOf<T>;
      for (const ev of diffTaskEvents(null, t, actor, now)) {
        this.db.task_events.set(ev.id, ev);
        changes.push({ table: "task_events", type: "upsert", row: ev });
      }
    }
    if (table === "comments") {
      const c = stored as Comment;
      const task = this.db.tasks.get(c.task_id);
      const ev: TaskEvent = {
        id: uid(),
        task_id: c.task_id,
        project_id: task?.project_id ?? "",
        actor_id: actor,
        kind: "commented",
        old_value: null,
        new_value: c.id,
        created_at: c.created_at,
      };
      this.db.task_events.set(ev.id, ev);
      changes.push({ table: "task_events", type: "upsert", row: ev });
    }
    (this.db[table] as Map<string, RowOf<T>>).set(rowKey(table, stored as never), stored);
    changes.unshift({ table, type: "upsert", row: stored });
    this.commit(changes);
    return stored;
  }

  async update<T extends TableName>(table: T, key: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>> {
    const map = this.db[table] as Map<string, RowOf<T>>;
    const prev = map.get(key);
    if (!prev) throw new Error("Élément introuvable — il a peut-être été supprimé.");
    const now = new Date().toISOString();
    let next = { ...prev, ...patch } as RowOf<T>;
    const changes: Change[] = [];
    if (table === "tasks") {
      const t = withDerivedFields(prev as Task, next as Task, now);
      next = t as RowOf<T>;
      for (const ev of diffTaskEvents(prev as Task, t, this.getActor(), now)) {
        this.db.task_events.set(ev.id, ev);
        changes.push({ table: "task_events", type: "upsert", row: ev });
      }
    }
    if (table === "comments") (next as Comment).updated_at = now;
    if (table === "workflows") {
      (next as Workflow).updated_at = now;
      (next as Workflow).updated_by = this.getActor();
    }
    map.set(key, next);
    changes.unshift({ table, type: "upsert", row: next });
    this.commit(changes);
    return next;
  }

  async remove(table: TableName, key: string): Promise<void> {
    const changes: Change[] = [];
    const drop = (t: TableName, k: string) => {
      if (this.db[t].delete(k)) changes.push({ table: t, type: "delete", key: k });
    };
    const cascade = (t: TableName, k: string) => {
      if (t === "tasks") {
        for (const [sk, s] of this.db.subtasks) if (s.task_id === k) drop("subtasks", sk);
        for (const [ck, c] of this.db.comments) if (c.task_id === k) drop("comments", ck);
        for (const [ek, e] of this.db.task_events) if (e.task_id === k) drop("task_events", ek);
        for (const [pk, p] of this.db.meeting_priorities) if (p.task_id === k) drop("meeting_priorities", pk);
      }
      if (t === "meetings") {
        for (const [ik, i] of this.db.meeting_items) if (i.meeting_id === k) drop("meeting_items", ik);
        for (const [pk, p] of this.db.meeting_priorities) if (p.meeting_id === k) drop("meeting_priorities", pk);
      }
      if (t === "projects") {
        for (const [wk, w] of this.db.workflows) {
          if (w.project_id === k) {
            const unlinked = { ...w, project_id: null };
            this.db.workflows.set(wk, unlinked);
            changes.push({ table: "workflows", type: "upsert", row: unlinked });
          }
        }
        for (const [tk, task] of this.db.tasks) {
          if (task.project_id !== k) continue;
          cascade("tasks", tk);
          drop("tasks", tk);
        }
      }
    };
    cascade(table, key);
    drop(table, key);
    this.commit(changes);
  }

  async ensureMeeting(row: Meeting): Promise<Meeting> {
    const existing = [...this.db.meetings.values()].find((m) => m.week_start === row.week_start);
    return existing ?? this.insert("meetings", row);
  }

  /* ------------------------------------------------------------------ */

  private commit(changes: Change[]) {
    if (!changes.length) return;
    this.persist();
    // Deliver asynchronously, like a realtime echo.
    queueMicrotask(() => {
      for (const l of this.listeners) for (const c of changes) l(c);
    });
    this.channel?.postMessage({ type: "changes", changes });
  }

  private applyRemote(changes: Change[]) {
    for (const c of changes) {
      const map = this.db[c.table] as Map<string, RowOf<TableName>>;
      if (c.type === "upsert") map.set(rowKey(c.table, c.row as never), c.row);
      else map.delete(c.key);
    }
    for (const l of this.listeners) for (const c of changes) l(c);
  }

  private reload() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.db = toDb(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }

  private ensureChannel() {
    if (this.channel || typeof BroadcastChannel === "undefined") return;
    try {
      this.channel = new BroadcastChannel(CHANNEL);
    } catch {
      // Sandboxed or restricted contexts: single-tab mode, everything else works.
      this.channel = null;
      return;
    }
    this.channel.addEventListener("message", (e: MessageEvent) => {
      if (e.data?.type === "changes") this.applyRemote(e.data.changes as Change[]);
    });
  }

  /**
   * Written synchronously on every change: a snapshot is ~100 KB, and a
   * debounce would lose the last edit when the tab is closed or reloaded
   * right after it.
   */
  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSnapshot(this.db)));
    } catch {
      /* quota or private mode: keep working in memory */
    }
  }

  /** Read-only accessor used by `reset()` consumers. */
  snapshot(): Snapshot {
    return toSnapshot(this.db);
  }
}
