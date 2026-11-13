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
import { canSeeConversation, GENERAL_CHANNEL_ID, olderMessages, recentPerConversation } from "../chat";
import type {
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  Comment,
  Meeting,
  Member,
  MemberColor,
  RowOf,
  Snapshot,
  TableName,
  Task,
  TaskAttachment,
  TaskEvent,
  Workflow,
} from "../types";
import { uid } from "../utils";
import { EMAIL_PATTERN, passwordProblem } from "../passwords";
import { rowKey, TABLES, type AccountOutcome, type Change, type DataAdapter, type FileUpload, type NewAccount, type PresenceState } from "./adapter";
import { clearDemoFiles, demoFileUrl, putDemoFile, removeDemoFiles } from "./demo-files";
import { buildDemoSnapshot } from "./seed";

// v2: the demo team became the real team (names, portraits). Demos saved before start afresh.
const STORAGE_KEY = "tthq:demo:db:v2";
const RETIRED_KEYS = ["tthq:demo:db:v1"];
const CHANNEL = "tthq:demo:sync";
const PRESENCE_CHANNEL = "tthq:demo:presence";
/** Same words as the Supabase adapter when Row Level Security says no. */
const DENIED = "Action refusée : vous n'avez pas les droits nécessaires.";

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
      for (const key of RETIRED_KEYS) localStorage.removeItem(key);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) snapshot = JSON.parse(raw) as Snapshot;
    } catch {
      snapshot = null;
    }
    if (!snapshot || !Array.isArray(snapshot.tasks)) {
      snapshot = buildDemoSnapshot();
    }
    // A demo saved before files could be attached: it gets the two sample files, if their task is still there.
    if (!Array.isArray(snapshot.attachments)) {
      const fresh = buildDemoSnapshot();
      const tasks = new Set(snapshot.tasks.map((t) => t.id));
      snapshot.attachments = fresh.attachments.filter((a) => tasks.has(a.task_id));
    }
    // Forward-compat: make sure every table exists.
    for (const t of TABLES) if (!Array.isArray(snapshot[t])) (snapshot as unknown as Record<string, unknown[]>)[t] = [];
    // A demo saved before the chat existed: give it the channel and its sample conversations.
    if (!snapshot.chat_conversations.some((c) => c.id === GENERAL_CHANNEL_ID)) {
      const fresh = buildDemoSnapshot();
      const known = new Set(snapshot.members.map((m) => m.id));
      snapshot.chat_conversations = fresh.chat_conversations.filter(
        (c) => c.kind === "channel" || (known.has(c.member_a as string) && known.has(c.member_b as string)),
      );
      const kept = new Set(snapshot.chat_conversations.map((c) => c.id));
      snapshot.chat_messages = fresh.chat_messages.filter((m) => kept.has(m.conversation_id));
      snapshot.chat_participants = fresh.chat_participants.filter((p) => kept.has(p.conversation_id) && known.has(p.member_id));
    }
    // A demo saved before the super administrator existed: its first administrator becomes one,
    // and nobody has a password to change.
    for (const m of snapshot.members) m.must_change_password = m.must_change_password ?? false;
    if (!snapshot.members.some((m) => m.role === "super_admin")) {
      const first = [...snapshot.members].filter((m) => m.role === "admin" && m.active).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
      if (first) first.role = "super_admin";
    }
    this.db = toDb(snapshot);
    this.persist();
    this.ensureChannel();
    return this.loaded();
  }

  /** Wipes local changes and restores fresh demo data (all tabs). */
  reset(): Snapshot {
    void clearDemoFiles();
    this.db = toDb(buildDemoSnapshot());
    this.persist();
    this.channel?.postMessage({ type: "reset" });
    return this.loaded();
  }

  /** What a load hands over: like the server, only the latest messages of each conversation. */
  private loaded(): Snapshot {
    const snapshot = toSnapshot(this.db);
    return { ...snapshot, chat_messages: recentPerConversation(snapshot.chat_messages) };
  }

  async loadTaskEvents(taskId: string): Promise<TaskEvent[]> {
    return [...this.db.task_events.values()].filter((e) => e.task_id === taskId);
  }

  async loadChatMessages(conversationId: string, before: string, limit: number): Promise<ChatMessage[]> {
    return olderMessages([...this.db.chat_messages.values()], conversationId, before, limit);
  }

  async openDirect(row: ChatConversation): Promise<ChatConversation> {
    const existing = [...this.db.chat_conversations.values()].find(
      (c) => c.kind === "direct" && c.member_a === row.member_a && c.member_b === row.member_b,
    );
    return existing ?? this.insert("chat_conversations", row);
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

  /* ------------------------- accounts (simulated) ------------------------ */
  // Nobody signs in to the demo: an account is a member row, and a password is only the flag
  // that says it must be changed. The same checks as the server, so the screens behave alike.

  private actorIsSuperAdmin(): boolean {
    const me = this.db.members.get(this.getActor() ?? "");
    return !!me && me.active && me.role === "super_admin";
  }

  async createAccount(input: NewAccount): Promise<AccountOutcome<{ member: Member }>> {
    if (!this.actorIsSuperAdmin()) return { ok: false, error: "Seul un super administrateur peut gérer les comptes et les mots de passe." };
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim().replace(/\s+/g, " ");
    if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Ce courriel n'est pas valide." };
    if (fullName.length < 2) return { ok: false, error: "Indiquez le nom complet (2 à 80 caractères)." };
    const problem = passwordProblem(input.password);
    if (problem) return { ok: false, error: `Mot de passe : ${problem.charAt(0).toLowerCase()}${problem.slice(1)}` };
    if ([...this.db.members.values()].some((m) => m.email === email)) return { ok: false, error: "Un compte existe déjà pour ce courriel." };

    const palette: MemberColor[] = ["teal", "amber", "indigo", "rose", "sky", "violet", "emerald", "orange", "slate"];
    const member: Member = {
      id: uid(),
      email,
      full_name: fullName,
      color: palette[this.db.members.size % palette.length],
      avatar_url: null,
      role: input.role === "admin" ? "admin" : "member",
      active: true,
      must_change_password: true,
      created_at: new Date().toISOString(),
    };
    const changes: Change[] = [{ table: "members", type: "upsert", row: member }];
    this.db.members.set(member.id, member);
    // An invitation waiting for that address has done its job.
    if (this.db.invites.delete(email)) changes.push({ table: "invites", type: "delete", key: email });
    this.commit(changes);
    return { ok: true, member };
  }

  async setMemberPassword(memberId: string, password: string): Promise<AccountOutcome> {
    if (!this.actorIsSuperAdmin()) return { ok: false, error: "Seul un super administrateur peut gérer les comptes et les mots de passe." };
    const problem = passwordProblem(password);
    if (problem) return { ok: false, error: problem };
    const member = this.db.members.get(memberId);
    if (!member) return { ok: false, error: "Ce membre n'existe plus." };
    const next = { ...member, must_change_password: true };
    this.db.members.set(memberId, next);
    this.commit([{ table: "members", type: "upsert", row: next }]);
    return { ok: true };
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
    // A file is added in one's own name, now; the task's history says so.
    if (table === "attachments") {
      const a = { ...(stored as TaskAttachment), uploader_id: actor, created_at: now };
      stored = a as RowOf<T>;
      const ev: TaskEvent = {
        id: uid(),
        task_id: a.task_id,
        project_id: this.db.tasks.get(a.task_id)?.project_id ?? "",
        actor_id: actor,
        kind: "attached",
        old_value: null,
        new_value: a.name,
        created_at: now,
      };
      this.db.task_events.set(ev.id, ev);
      changes.push({ table: "task_events", type: "upsert", row: ev });
    }
    // Same rules as the database: a message is posted as oneself, now, where one
    // may read; "read up to here" means up to now.
    if (table === "chat_messages") {
      const conversation = this.db.chat_conversations.get((stored as ChatMessage).conversation_id);
      if (!conversation || !canSeeConversation(conversation, actor)) throw new Error(DENIED);
      stored = { ...(stored as ChatMessage), author_id: actor, created_at: now, deleted_at: null } as RowOf<T>;
    }
    if (table === "chat_participants") {
      stored = { ...(stored as ChatParticipant), last_read_at: now } as RowOf<T>;
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
    if (table === "chat_messages") {
      // A message is never edited; its author can delete it (once), which erases its text.
      const before = prev as ChatMessage;
      const after = next as ChatMessage;
      if (before.author_id !== this.getActor()) throw new Error(DENIED);
      const deleted = before.deleted_at ?? (after.deleted_at ? now : null);
      next = { ...before, deleted_at: deleted, body: deleted ? "" : before.body } as RowOf<T>;
    }
    if (table === "chat_participants") {
      next = { ...(prev as ChatParticipant), last_read_at: now } as RowOf<T>;
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
        for (const [ak, a] of this.db.attachments) if (a.task_id === k) drop("attachments", ak);
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

  /**
   * The bytes stay in this browser. The progress is played out, briefly, so that the
   * demo shows what an upload looks like: a real one takes its time.
   */
  async uploadFile({ path, file, onProgress, signal }: FileUpload): Promise<void> {
    const steps = Math.min(8, 3 + Math.floor(file.size / (2 * 1024 * 1024)));
    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 110));
      if (signal?.aborted) throw new Error("Envoi annulé.");
      onProgress?.(Math.round((file.size * i) / steps), file.size);
    }
    await putDemoFile(path, file);
  }

  fileUrl(path: string): Promise<string> {
    return demoFileUrl(path);
  }

  removeFiles(paths: string[]): Promise<void> {
    return removeDemoFiles(paths);
  }

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
