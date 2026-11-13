"use client";

/**
 * Client store. Holds the whole workspace in memory (a small team has a few
 * hundred tasks), applies every mutation optimistically, persists it through
 * the adapter, and merges realtime changes coming from teammates.
 */
import { toast } from "sonner";
import { create } from "zustand";
import { ATTACHMENT_MAX_AT_ONCE, attachmentProblem, makeThumbnail, newAttachment, storedPaths, thumbPathOf } from "./attachments";
import { CHAT_BODY_MAX, CHAT_PAGE, directPair, findDirect, isUnread, mergeLoadedMessages, participantKey } from "./chat";
import { rowKey, TABLES, type Change, type DataAdapter, type NewAccount, type PresenceState } from "./data/adapter";
import { weekStartDateOnly } from "./dates";
import { isSupabaseConfigured } from "./supabase/config";
import { buildMeetingSummary, editablePriorityMeeting, prioritiesFor } from "./selectors";
import { reigningChampion, type TeamTowerView, type TowerBoards } from "./tower/boards";
import { launchDescription, launchTitle, planLaunch } from "./workflow-run";
import { withDerivedFields } from "./task-logic";
import type {
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  Comment,
  ID,
  Meeting,
  MeetingItem,
  MeetingPriority,
  Member,
  MemberInvite,
  Project,
  RowOf,
  Snapshot,
  Subtask,
  TableName,
  Task,
  TaskAttachment,
  TaskEvent,
  TaskPriority,
  TaskStatus,
  Workflow,
  WorkflowDoc,
} from "./types";
import { nowIso, positionBetween, slugify, uid } from "./utils";

type Tables = { [K in TableName]: Record<string, RowOf<K>> };

export type BootStatus = "booting" | "ready" | "pending-access" | "password-change" | "error";

export interface QuickAddDefaults {
  project_id?: ID;
  assignee_id?: ID | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  weekPriority?: boolean;
}

/** A file on its way to a task: shown beside the files that are already there. */
export interface PendingUpload {
  /** The id its row will have. */
  id: ID;
  task_id: ID;
  name: string;
  mime_type: string;
  size: number;
  /** Bytes sent so far. */
  sent: number;
  /** What went wrong, in words. The upload can then be tried again, or dropped. */
  error: string | null;
  /** The storage server refused this very file (too large for it, not allowed): trying again is not offered. */
  refused: boolean;
}

export interface ConfirmRequest {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
}

export interface AppState extends Tables {
  status: BootStatus;
  error: string | null;
  mode: "demo" | "supabase";
  meId: ID | null;
  presence: PresenceState[];
  openTaskId: ID | null;
  quickAdd: { open: boolean; defaults: QuickAddDefaults };
  commandOpen: boolean;
  mobileNavOpen: boolean;
  /** The screen on show lays its tiles straight on the scene: the shell draws no sheet behind it. */
  bareWindow: boolean;
  confirm: ConfirmRequest | null;
  /** Conversations that have older messages on the server than the ones held here. */
  chatHasOlder: Record<ID, boolean>;
  /** Counts the tasks I have finished during this visit: each one is worth a few tomatoes (see TomatoRain). */
  tasksFinished: number;
  /** The last status I changed myself, counted: a tomato ripens where I did it (see TomatoRipen). */
  statusChanged: { n: number; from: TaskStatus; to: TaskStatus } | null;
  /** Files being sent from this browser, by the id of their future row. */
  uploads: Record<ID, PendingUpload>;
  /** Tomato Tower: who won the last week that is over. They wear a crown wherever their face shows. */
  towerChampionId: ID | null;
  /** Tomato Tower: the boards and the shared tower as last read from the server (null until then). */
  towerBoards: TowerBoards | null;
  towerTeam: TeamTowerView | null;
}

const emptyTables = () => Object.fromEntries(TABLES.map((t) => [t, {}])) as unknown as Tables;

export const useApp = create<AppState>()(() => ({
  ...emptyTables(),
  status: "booting",
  error: null,
  mode: isSupabaseConfigured ? "supabase" : "demo",
  meId: null,
  presence: [],
  openTaskId: null,
  quickAdd: { open: false, defaults: {} },
  commandOpen: false,
  mobileNavOpen: false,
  bareWindow: false,
  confirm: null,
  chatHasOlder: {},
  tasksFinished: 0,
  statusChanged: null,
  uploads: {},
  towerChampionId: null,
  towerBoards: null,
  towerTeam: null,
}));

const set = useApp.setState;
const get = useApp.getState;

/* ------------------------------------------------------------------ */
/* Adapter wiring                                                      */
/* ------------------------------------------------------------------ */

let adapter: DataAdapter | null = null;
/** Rows with a local write in flight: realtime echoes are ignored meanwhile. */
const pending = new Map<string, number>();
const pk = (table: TableName, key: string) => `${table}:${key}`;

export function getAdapter(): DataAdapter {
  if (!adapter) throw new Error("Adapter not initialised");
  return adapter;
}

export function attachAdapter(a: DataAdapter) {
  adapter = a;
  set({ mode: a.mode });
}

export function hydrate(snapshot: Snapshot) {
  const tables = emptyTables();
  for (const t of TABLES) {
    const rec: Record<string, RowOf<TableName>> = {};
    for (const row of snapshot[t] as RowOf<TableName>[]) rec[rowKey(t, row as never)] = row;
    (tables as unknown as Record<string, unknown>)[t] = rec;
  }
  // A load brings the latest messages of each conversation: see mergeLoadedMessages
  // for what happens to the older pages a thread had already fetched.
  const chat = mergeLoadedMessages(snapshot.chat_messages, get().chat_messages, get().chatHasOlder);
  tables.chat_messages = chat.messages;
  set({ ...tables, chatHasOlder: chat.hasOlder });
}

function putRow<T extends TableName>(table: T, row: RowOf<T>) {
  const key = rowKey(table, row as never);
  set((s) => ({ [table]: { ...s[table], [key]: row } }) as Partial<AppState>);
}

function dropRow(table: TableName, key: string) {
  set((s) => {
    if (!(key in s[table])) return {};
    const next = { ...s[table] } as Record<string, unknown>;
    delete next[key];
    const patch: Partial<AppState> = { [table]: next } as Partial<AppState>;
    if (table === "tasks" && s.openTaskId === key) patch.openTaskId = null;
    return patch;
  });
}

/** Incoming change from the adapter (realtime / other tab). */
export function applyChange(c: Change) {
  const key = c.type === "delete" ? c.key : rowKey(c.table, c.row as never);
  if (pending.get(pk(c.table, key))) return;
  if (c.type === "delete") {
    dropRow(c.table, key);
    if (c.table === "tasks") {
      // Postgres cascades: mirror it locally.
      const s = get();
      for (const st of Object.values(s.subtasks)) if (st.task_id === key) dropRow("subtasks", st.id);
      for (const cm of Object.values(s.comments)) if (cm.task_id === key) dropRow("comments", cm.id);
      for (const at of Object.values(s.attachments)) if (at.task_id === key) dropRow("attachments", at.id);
      for (const mp of Object.values(s.meeting_priorities))
        if (mp.task_id === key) dropRow("meeting_priorities", rowKey("meeting_priorities", mp as never));
    }
  } else {
    // Realtime can deliver the echo of an older write after a newer one was
    // confirmed: rows that carry `updated_at` never go back in time.
    const current = get()[c.table][key] as { updated_at?: string } | undefined;
    const incoming = c.row as { updated_at?: string };
    if (current?.updated_at && incoming.updated_at && incoming.updated_at < current.updated_at) return;
    putRow(c.table, c.row);
    // My own row changing under me: an access taken away, or a password set for me by the
    // super administrator. Either way the workspace closes until it is sorted out.
    if (c.table === "members" && c.row && (c.row as Member).id === get().meId) {
      const me = c.row as Member;
      if (!me.active) set({ status: "pending-access" });
      else if (me.must_change_password && get().status === "ready") set({ status: "password-change" });
    }
  }
}

export function setPresence(states: PresenceState[]) {
  set({ presence: states });
}

/* ------------------------------------------------------------------ */
/* Generic optimistic write                                            */
/* ------------------------------------------------------------------ */

/** A task write the database turns into a push notification (see the push_outbox triggers). */
function worthAnnouncing(before: Task | undefined, after: Task | null): boolean {
  if (!after) return false;
  if (!before) return true;
  if (after.status !== before.status && (after.status === "done" || after.status === "blocked")) return true;
  return !!after.assignee_id && after.assignee_id !== before.assignee_id;
}

let pushKick: ReturnType<typeof setTimeout> | null = null;
/**
 * Lets the server send what the database has just queued, once the burst of
 * writes is over: a workflow creates its tasks one by one, and they make one
 * message for each person rather than one per task.
 */
function schedulePushKick() {
  if (pushKick) clearTimeout(pushKick);
  pushKick = setTimeout(() => {
    pushKick = null;
    adapter?.pushKick();
  }, 1200);
}

async function write<T extends TableName>(
  table: T,
  key: string,
  optimistic: RowOf<T> | null,
  run: () => Promise<RowOf<T> | void>,
  /** Shown in a toast when the write fails. Null: fail quietly (background writes). */
  errorLabel: string | null,
): Promise<boolean> {
  const before = get()[table][key] as RowOf<T> | undefined;
  const id = pk(table, key);
  pending.set(id, (pending.get(id) ?? 0) + 1);
  if (optimistic) putRow(table, optimistic);
  else dropRow(table, key);
  try {
    const saved = await run();
    if (saved) putRow(table, saved);
    if (table === "tasks" && worthAnnouncing(before as Task | undefined, optimistic as Task | null)) schedulePushKick();
    return true;
  } catch (err) {
    if (before) putRow(table, before);
    else dropRow(table, key);
    if (errorLabel) toast.error(errorLabel, { description: err instanceof Error ? err.message : undefined });
    return false;
  } finally {
    const n = (pending.get(id) ?? 1) - 1;
    if (n <= 0) pending.delete(id);
    else pending.set(id, n);
  }
}

function patchRow<T extends TableName>(table: T, key: string, patch: Partial<RowOf<T>>, errorLabel: string) {
  const current = get()[table][key] as RowOf<T> | undefined;
  if (!current) return Promise.resolve(false);
  let next = { ...current, ...patch } as RowOf<T>;
  if (table === "tasks") next = withDerivedFields(current as Task, next as Task, nowIso()) as RowOf<T>;
  return write(table, key, next, () => getAdapter().update(table, key, patch), errorLabel);
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

/** Screens currently asking for a bare window (see ui.claimBareWindow). */
let bareClaims = 0;

export const ui = {
  openTask: (id: ID | null) => set({ openTaskId: id }),
  openQuickAdd: (defaults: QuickAddDefaults = {}) => set({ quickAdd: { open: true, defaults } }),
  closeQuickAdd: () => set((s) => ({ quickAdd: { ...s.quickAdd, open: false } })),
  setCommandOpen: (open: boolean) => set({ commandOpen: open }),
  setMobileNav: (open: boolean) => set({ mobileNavOpen: open }),
  /**
   * A screen that sits straight on the scene (the dashboard, the game) asks
   * for a window without its sheet of glass for as long as it shows. Returns
   * how to let go of it. Claims are counted, not switched: when one such
   * screen arrives as another leaves, the window stays bare whichever of the
   * two effects runs first (it used to end up with its sheet back, and the
   * dashboard drawn inside it).
   */
  claimBareWindow: () => {
    bareClaims += 1;
    set({ bareWindow: true });
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      bareClaims = Math.max(0, bareClaims - 1);
      set({ bareWindow: bareClaims > 0 });
    };
  },
  confirm: (request: ConfirmRequest) => set({ confirm: request }),
  closeConfirm: () => set({ confirm: null }),
};

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export interface NewTaskInput {
  project_id: ID;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: ID | null;
  due_date?: string | null;
  description?: string;
  meeting_id?: ID | null;
  /** Where to put it in its column. */
  placement?: "top" | "bottom";
  weekPriority?: boolean;
  /** The workflow and the step this task is made from. */
  workflow_id?: ID | null;
  workflow_step?: string | null;
}

function columnPositions(projectId: ID, status: TaskStatus): number[] {
  return Object.values(get().tasks)
    .filter((t) => t.project_id === projectId && t.status === status && !t.archived_at)
    .map((t) => t.position)
    .sort((a, b) => a - b);
}

export async function createTask(input: NewTaskInput): Promise<Task | null> {
  const title = input.title.trim();
  if (!title) return null;
  const status = input.status ?? "todo";
  const col = columnPositions(input.project_id, status);
  const position =
    input.placement === "top" ? positionBetween(undefined, col[0]) : positionBetween(col[col.length - 1], undefined);
  const now = nowIso();
  const task: Task = withDerivedFields(
    null,
    {
      id: uid(),
      project_id: input.project_id,
      title,
      description: input.description ?? "",
      status,
      priority: input.priority ?? "normal",
      assignee_id: input.assignee_id ?? null,
      due_date: input.due_date ?? null,
      position,
      meeting_id: input.meeting_id ?? liveMeeting()?.id ?? null,
      created_by: get().meId,
      created_at: now,
      updated_at: now,
      status_changed_at: now,
      completed_at: null,
      archived_at: null,
      workflow_id: input.workflow_id ?? null,
      workflow_step: input.workflow_step ?? null,
    },
    now,
  );
  const ok = await write("tasks", task.id, task, () => getAdapter().insert("tasks", task), "Impossible de créer la tâche");
  if (!ok) return null;
  if (input.weekPriority) await setWeekPriority(task.id, true);
  return get().tasks[task.id] ?? task;
}

export function updateTask(id: ID, patch: Partial<Task>) {
  // Every way of finishing a task goes through here (the check, the status, a card dropped in
  // « Terminé »). What teammates finish arrives by applyChange and is not counted.
  const current = get().tasks[id];
  if (current && current.status !== "done" && patch.status === "done") {
    set((s) => ({ tasksFinished: s.tasksFinished + 1 }));
  }
  // Same for any change of status: mine only, whatever the gesture (menu, check, card dropped in a column).
  if (current && patch.status && patch.status !== current.status) {
    const to = patch.status;
    set((s) => ({ statusChanged: { n: (s.statusChanged?.n ?? 0) + 1, from: current.status, to } }));
  }
  return patchRow("tasks", id, patch, "Modification non enregistrée");
}

export function setStatus(id: ID, status: TaskStatus) {
  const t = get().tasks[id];
  if (!t || t.status === status) return Promise.resolve(true);
  // Moving to another column: append at the end of it.
  const col = columnPositions(t.project_id, status);
  return updateTask(id, { status, position: positionBetween(col[col.length - 1], undefined) });
}

export function toggleDone(id: ID) {
  const t = get().tasks[id];
  if (!t) return;
  return setStatus(id, t.status === "done" ? "todo" : "done");
}

/** Drag & drop: place `id` in `status` between two neighbours. */
export function moveTask(id: ID, status: TaskStatus, beforeId: ID | null, afterId: ID | null) {
  const tasks = get().tasks;
  const before = beforeId ? tasks[beforeId]?.position : undefined;
  const after = afterId ? tasks[afterId]?.position : undefined;
  let position = positionBetween(before, after);
  if (before !== undefined && after !== undefined && Math.abs(after - before) < 1e-6) {
    position = before + 1e-7; // degenerate gap — extremely rare
  }
  const t = tasks[id];
  if (!t || (t.status === status && t.position === position)) return;
  return updateTask(id, { status, position });
}

export function archiveTask(id: ID, archived = true) {
  return updateTask(id, { archived_at: archived ? nowIso() : null });
}

export async function archiveDone(projectId: ID) {
  const done = Object.values(get().tasks).filter((t) => t.project_id === projectId && t.status === "done" && !t.archived_at);
  await Promise.all(done.map((t) => archiveTask(t.id)));
  return done.length;
}

export async function deleteTask(id: ID) {
  // The rows of its files go with the task (the database cascades); their bytes are removed here.
  const files = Object.values(get().attachments).filter((a) => a.task_id === id);
  cancelUploadsOf(id);
  const ok = await write("tasks", id, null, () => getAdapter().remove("tasks", id), "Suppression impossible");
  if (ok) {
    for (const a of files) dropRow("attachments", a.id);
    void forgetFiles(storedPaths(files));
  }
  return ok;
}

export async function duplicateTask(id: ID) {
  const t = get().tasks[id];
  if (!t) return null;
  const copy = await createTask({
    project_id: t.project_id,
    title: `${t.title} (copie)`,
    status: t.status === "done" ? "todo" : t.status,
    priority: t.priority,
    assignee_id: t.assignee_id,
    due_date: t.due_date,
    description: t.description,
    meeting_id: null,
  });
  if (copy) {
    const subs = Object.values(get().subtasks).filter((s) => s.task_id === id);
    for (const s of subs) await addSubtask(copy.id, s.title);
  }
  return copy;
}

/* ------------------------------ subtasks ----------------------------- */

export function addSubtask(taskId: ID, title: string) {
  const clean = title.trim();
  if (!clean) return Promise.resolve(false);
  const siblings = Object.values(get().subtasks)
    .filter((s) => s.task_id === taskId)
    .map((s) => s.position)
    .sort((a, b) => a - b);
  const row: Subtask = {
    id: uid(),
    task_id: taskId,
    title: clean,
    done: false,
    position: positionBetween(siblings[siblings.length - 1], undefined),
    created_at: nowIso(),
  };
  return write("subtasks", row.id, row, () => getAdapter().insert("subtasks", row), "Sous-tâche non ajoutée");
}

export const updateSubtask = (id: ID, patch: Partial<Subtask>) =>
  patchRow("subtasks", id, patch, "Sous-tâche non modifiée");

export const deleteSubtask = (id: ID) =>
  write("subtasks", id, null, () => getAdapter().remove("subtasks", id), "Sous-tâche non supprimée");

/* ------------------------------ comments ----------------------------- */

export function addComment(taskId: ID, body: string) {
  const clean = body.trim();
  if (!clean) return Promise.resolve(false);
  const now = nowIso();
  const row: Comment = { id: uid(), task_id: taskId, author_id: get().meId, body: clean, created_at: now, updated_at: now };
  return write("comments", row.id, row, () => getAdapter().insert("comments", row), "Commentaire non publié");
}

export const updateComment = (id: ID, body: string) =>
  patchRow("comments", id, { body: body.trim() }, "Commentaire non modifié");

export const deleteComment = (id: ID) =>
  write("comments", id, null, () => getAdapter().remove("comments", id), "Commentaire non supprimé");

/* ------------------------------ Tomato Tower -------------------------- */

/**
 * Reads the boards of the game, as the server computes them, and with them who
 * wears the crown. Best effort: null when the server did not answer (the game
 * is not worth an error screen; the boards come back with the next change).
 */
export async function loadTowerBoards(): Promise<TowerBoards | null> {
  try {
    const boards = await getAdapter().towerBoards();
    const before = get().towerBoards;
    const me = get().meId;
    // The week's first place was mine, and no longer is: said once, the way the game talks.
    const first = boards.week[0]?.member_id ?? null;
    if (before && before.week_start === boards.week_start && before.week[0]?.member_id === me && first && first !== me) {
      const who = get().members[first];
      toast(`${who ? who.full_name.split(" ")[0] : "Quelqu'un"} vient de détruire ton record 🍅`);
    }
    set({ towerBoards: boards, towerChampionId: reigningChampion(boards) });
    return boards;
  } catch {
    return null;
  }
}

/** At start-up: the crown is all the rest of the app needs from the game. */
export function refreshTowerChampion() {
  void loadTowerBoards();
}

/** Reads the tower the team builds together. Null when the server did not answer. */
export async function loadTowerTeam(): Promise<TeamTowerView | null> {
  try {
    const view = await getAdapter().towerTeam();
    set({ towerTeam: view });
    return view;
  } catch {
    return null;
  }
}

/**
 * Something changed in the game (a run was saved, a crate joined the shared
 * tower): what is on show is read again. The shared tower only once it has
 * been looked at.
 */
export function towerChanged() {
  void loadTowerBoards();
  if (get().towerTeam) void loadTowerTeam();
}

/** What the server answered when my crate was placed: the tower as it is now. */
export function setTowerTeam(view: TeamTowerView) {
  set({ towerTeam: view });
}

/* ---------------------------- attached files -------------------------- */

/** What an upload needs to be tried again or stopped: kept here, not in the state. */
const uploadJobs = new Map<ID, { file: File; row: TaskAttachment; abort: AbortController | null }>();
const uploadQueue: ID[] = [];
let uploadsRunning = 0;
/** Two at a time: a dozen photos dropped at once do not fight for the connection. */
const UPLOADS_AT_ONCE = 2;

const patchUpload = (id: ID, patch: Partial<PendingUpload>) =>
  set((s) => (s.uploads[id] ? { uploads: { ...s.uploads, [id]: { ...s.uploads[id], ...patch } } } : {}));

function dropUpload(id: ID) {
  uploadJobs.delete(id);
  set((s) => {
    if (!(id in s.uploads)) return {};
    const next = { ...s.uploads };
    delete next[id];
    return { uploads: next };
  });
}

/** Stored bytes that no row points to any more. Best effort: an orphan is invisible and harmless. */
async function forgetFiles(paths: string[]) {
  if (paths.length === 0) return;
  try {
    await getAdapter().removeFiles(paths);
  } catch {
    /* nothing the member can do about it */
  }
}

async function runUpload(id: ID) {
  const job = uploadJobs.get(id);
  if (!job) return;
  const abort = new AbortController();
  job.abort = abort;
  const { file } = job;
  let row = job.row;
  const sent: string[] = [];
  try {
    const adapter = getAdapter();
    // A small picture first, made here: lists then load a few kilobytes, not the file.
    const thumb = await makeThumbnail(file);
    if (abort.signal.aborted) throw new Error("Envoi annulé.");
    sent.push(row.storage_path);
    await adapter.uploadFile({
      path: row.storage_path,
      file,
      contentType: row.mime_type,
      signal: abort.signal,
      onProgress: (bytes) => patchUpload(id, { sent: bytes }),
    });
    if (thumb) {
      const path = thumbPathOf(row);
      try {
        sent.push(path);
        await adapter.uploadFile({ path, file: thumb, contentType: "image/jpeg", signal: abort.signal });
        row = { ...row, thumb_path: path };
      } catch {
        // The file itself is stored: it simply has no thumbnail.
        sent.pop();
        if (abort.signal.aborted) throw new Error("Envoi annulé.");
      }
    }
    // The file is safe: now, and only now, the task says it has it.
    const saved = await adapter.insert("attachments", row);
    putRow("attachments", saved);
    dropUpload(id);
  } catch (err) {
    void forgetFiles(sent);
    if (abort.signal.aborted) dropUpload(id);
    else
      patchUpload(id, {
        error: err instanceof Error ? err.message : "L'envoi a échoué.",
        refused: err instanceof Error && err.name === "UploadRefused",
        sent: 0,
      });
  } finally {
    if (uploadJobs.get(id)) uploadJobs.get(id)!.abort = null;
  }
}

function pumpUploads() {
  while (uploadsRunning < UPLOADS_AT_ONCE && uploadQueue.length > 0) {
    const id = uploadQueue.shift()!;
    if (!uploadJobs.has(id)) continue;
    uploadsRunning += 1;
    void runUpload(id).finally(() => {
      uploadsRunning -= 1;
      pumpUploads();
    });
  }
}

/**
 * Attaches files to a task. Each one shows at once among the task's files, with
 * its progress; its row is written when its bytes are stored. A file that is too
 * large is refused here, in words, before anything is sent.
 */
export function attachFiles(taskId: ID, files: File[]) {
  if (!get().tasks[taskId] || files.length === 0) return;
  if (files.length > ATTACHMENT_MAX_AT_ONCE) {
    toast.error(`${files.length} fichiers d'un coup, c'est beaucoup : ${ATTACHMENT_MAX_AT_ONCE} au plus à la fois.`);
    return;
  }
  const now = nowIso();
  for (const file of files) {
    const problem = attachmentProblem(file);
    if (problem) {
      toast.error(`« ${file.name} » n'a pas été joint`, { description: problem });
      continue;
    }
    const row = newAttachment(taskId, file, get().meId, now);
    uploadJobs.set(row.id, { file, row, abort: null });
    set((s) => ({
      uploads: {
        ...s.uploads,
        [row.id]: { id: row.id, task_id: taskId, name: row.name, mime_type: row.mime_type, size: row.size, sent: 0, error: null, refused: false },
      },
    }));
    uploadQueue.push(row.id);
  }
  pumpUploads();
}

/** Stops an upload in flight, or drops one that failed or is still waiting. Nothing is left behind. */
export function cancelUpload(id: ID) {
  const job = uploadJobs.get(id);
  if (job?.abort) job.abort.abort();
  else dropUpload(id);
}

export function retryUpload(id: ID) {
  if (!uploadJobs.has(id) || !get().uploads[id]?.error) return;
  patchUpload(id, { error: null, refused: false, sent: 0 });
  uploadQueue.push(id);
  pumpUploads();
}

function cancelUploadsOf(taskId: ID) {
  for (const u of Object.values(get().uploads)) if (u.task_id === taskId) cancelUpload(u.id);
}

/** Removes a file from its task: the row first (the task no longer shows it), then its bytes. */
export async function deleteAttachment(id: ID) {
  const row = get().attachments[id];
  if (!row) return false;
  const ok = await write("attachments", id, null, () => getAdapter().remove("attachments", id), "Fichier non retiré");
  if (ok) void forgetFiles(storedPaths([row]));
  return ok;
}

/** A temporary address for a stored file (see DataAdapter.fileUrl). */
export const fileUrl = (path: string, download?: string) => getAdapter().fileUrl(path, download);

export async function loadTaskHistory(taskId: ID) {
  try {
    const events = await getAdapter().loadTaskEvents(taskId);
    set((s) => {
      const next = { ...s.task_events };
      for (const e of events) next[e.id] = e as TaskEvent;
      return { task_events: next };
    });
  } catch {
    /* history is best-effort */
  }
}

/* ------------------------------------------------------------------ */
/* Meetings                                                            */
/* ------------------------------------------------------------------ */

export function liveMeeting(): Meeting | null {
  return Object.values(get().meetings).find((m) => m.status === "live") ?? null;
}

export function meetingForWeek(weekStart: string): Meeting | null {
  return Object.values(get().meetings).find((m) => m.week_start === weekStart) ?? null;
}

/** Returns the meeting row of a week, creating it (planned) if needed. */
export async function ensureMeeting(weekStart: string): Promise<Meeting | null> {
  const existing = meetingForWeek(weekStart);
  if (existing) return existing;
  const row: Meeting = {
    id: uid(),
    week_start: weekStart,
    status: "planned",
    started_at: null,
    ended_at: null,
    started_by: null,
    attendees: [],
    notes: "",
    summary: null,
    created_at: nowIso(),
  };
  try {
    // A teammate may create the same week's meeting at the same moment:
    // the adapter returns whichever row won.
    const saved = await getAdapter().ensureMeeting(row);
    putRow("meetings", saved);
    return saved;
  } catch (err) {
    toast.error("Meeting non créé", { description: err instanceof Error ? err.message : undefined });
    return meetingForWeek(weekStart);
  }
}

export async function startMeeting(weekStart: string) {
  const m = await ensureMeeting(weekStart);
  if (!m) return null;
  // A meeting someone forgot to close would keep collecting tasks and priorities.
  for (const other of Object.values(get().meetings)) {
    if (other.status === "live" && other.id !== m.id) await closeMeeting(other.id);
  }
  const s = get();
  const online = new Set(s.presence.map((p) => p.member_id));
  const attendees = Object.values(s.members)
    .filter((x) => x.active && (online.size === 0 || online.has(x.id) || x.id === s.meId))
    .map((x) => x.id);
  await patchRow(
    "meetings",
    m.id,
    { status: "live", started_at: m.started_at ?? nowIso(), started_by: s.meId, attendees },
    "Impossible de démarrer le meeting",
  );
  return get().meetings[m.id];
}

export async function closeMeeting(id: ID) {
  const s = get();
  const m = s.meetings[id];
  if (!m) return;
  const closedAt = nowIso();
  const summary = buildMeetingSummary(
    {
      tasks: Object.values(s.tasks),
      members: Object.values(s.members),
      projects: Object.values(s.projects),
      items: Object.values(s.meeting_items),
      priorities: Object.values(s.meeting_priorities),
      meetings: Object.values(s.meetings),
    },
    { ...m, status: "closed" },
    closedAt,
  );
  return patchRow("meetings", id, { status: "closed", ended_at: closedAt, summary }, "Impossible de clôturer le meeting");
}

export function reopenMeeting(id: ID) {
  return patchRow("meetings", id, { status: "live", ended_at: null }, "Impossible de rouvrir le meeting");
}

export function setAttendees(id: ID, attendees: ID[]) {
  return patchRow("meetings", id, { attendees }, "Participants non enregistrés");
}

export async function addMeetingItem(
  weekStart: string,
  kind: MeetingItem["kind"],
  body: string,
  projectId: ID | null = null,
) {
  const clean = body.trim();
  if (!clean) return false;
  const m = await ensureMeeting(weekStart);
  if (!m) return false;
  const siblings = Object.values(get().meeting_items)
    .filter((i) => i.meeting_id === m.id && i.kind === kind)
    .map((i) => i.position)
    .sort((a, b) => a - b);
  const row: MeetingItem = {
    id: uid(),
    meeting_id: m.id,
    kind,
    body: clean,
    project_id: projectId,
    author_id: get().meId,
    done: kind === "decision",
    position: positionBetween(siblings[siblings.length - 1], undefined),
    created_at: nowIso(),
  };
  return write("meeting_items", row.id, row, () => getAdapter().insert("meeting_items", row), "Élément non ajouté");
}

export const updateMeetingItem = (id: ID, patch: Partial<MeetingItem>) =>
  patchRow("meeting_items", id, patch, "Élément non modifié");

export const deleteMeetingItem = (id: ID) =>
  write("meeting_items", id, null, () => getAdapter().remove("meeting_items", id), "Élément non supprimé");

/* ---------------------------- week priorities ------------------------ */

/** Meeting that receives the ★ toggles (see `editablePriorityMeeting`). */
export function priorityMeeting(): Meeting | null {
  return editablePriorityMeeting(Object.values(get().meetings));
}

export async function setWeekPriority(taskId: ID, on: boolean, meetingId?: ID) {
  let m: Meeting | null = meetingId ? get().meetings[meetingId] : priorityMeeting();
  if (!m) m = await ensureMeeting(weekStartDateOnly(new Date()));
  if (!m) return false;
  const key = `${m.id}:${taskId}`;
  const exists = !!get().meeting_priorities[key];
  if (on === exists) return true;
  if (!on) {
    return write("meeting_priorities", key, null, () => getAdapter().remove("meeting_priorities", key), "Priorité non retirée");
  }
  const siblings = prioritiesFor(m.id, Object.values(get().meeting_priorities)).map((p) => p.position);
  const row: MeetingPriority = {
    meeting_id: m.id,
    task_id: taskId,
    position: positionBetween(siblings[siblings.length - 1], undefined),
    created_by: get().meId,
    created_at: nowIso(),
  };
  return write("meeting_priorities", key, row, () => getAdapter().insert("meeting_priorities", row), "Priorité non ajoutée");
}

/* ------------------------------------------------------------------ */
/* Members & projects                                                  */
/* ------------------------------------------------------------------ */

export const updateMember = (id: ID, patch: Partial<Member>) => patchRow("members", id, patch, "Profil non enregistré");

export function inviteMember(email: string, role: Member["role"] = "member") {
  const clean = email.trim().toLowerCase();
  const row: MemberInvite = { email: clean, role, invited_by: get().meId, created_at: nowIso() };
  return write("invites", clean, row, () => getAdapter().insert("invites", row), "Invitation non enregistrée");
}

export const revokeInvite = (email: string) =>
  write("invites", email, null, () => getAdapter().remove("invites", email), "Invitation non retirée");

/**
 * A member created by the super administrator, with a temporary password to hand over.
 * Not optimistic: the account exists once the server says so, and the answer says why not.
 */
export async function createAccount(input: NewAccount) {
  try {
    const out = await getAdapter().createAccount(input);
    if (out.ok) {
      applyChange({ table: "members", type: "upsert", row: out.member });
      // The invitation that may have waited for that address has been used.
      if (get().invites[out.member.email]) applyChange({ table: "invites", type: "delete", key: out.member.email });
    }
    return out;
  } catch {
    return { ok: false as const, error: "Connexion impossible. Vérifiez votre réseau, puis réessayez." };
  }
}

/** A new temporary password for a member: they will have to choose their own at the next sign-in. */
export async function setMemberPassword(id: ID, password: string) {
  try {
    const out = await getAdapter().setMemberPassword(id, password);
    const member = get().members[id];
    if (out.ok && member) applyChange({ table: "members", type: "upsert", row: { ...member, must_change_password: true } });
    return out;
  } catch {
    return { ok: false as const, error: "Connexion impossible. Vérifiez votre réseau, puis réessayez." };
  }
}

/** The address a member signs in with. Their password does not change, and nothing is sent. */
export async function setMemberEmail(id: ID, email: string) {
  try {
    const out = await getAdapter().setMemberEmail(id, email);
    if (out.ok) applyChange({ table: "members", type: "upsert", row: out.member });
    return out;
  } catch {
    return { ok: false as const, error: "Connexion impossible. Vérifiez votre réseau, puis réessayez." };
  }
}

export async function createProject(input: Pick<Project, "name" | "description" | "color" | "icon">) {
  const s = get();
  const existing = new Set(Object.values(s.projects).map((p) => p.slug));
  let slug = slugify(input.name) || "projet";
  for (let i = 2; existing.has(slug); i++) slug = `${slugify(input.name)}-${i}`;
  const positions = Object.values(s.projects).map((p) => p.position);
  const row: Project = {
    id: uid(),
    slug,
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color,
    icon: input.icon,
    position: (positions.length ? Math.max(...positions) : 0) + 1,
    archived_at: null,
    created_at: nowIso(),
    created_by: s.meId,
  };
  const ok = await write("projects", row.id, row, () => getAdapter().insert("projects", row), "Projet non créé");
  return ok ? row : null;
}

export const updateProject = (id: ID, patch: Partial<Project>) =>
  patchRow("projects", id, patch, "Projet non modifié");

/* ------------------------------------------------------------------ */
/* Workflows                                                           */
/* ------------------------------------------------------------------ */

/**
 * A new workflow starts with one piece of work, to be named, placed in a
 * project and given to someone: a workflow is a deliverable cut into the tasks
 * each person gets, not a machine waiting for a trigger.
 */
const starterDoc = (projectId: ID | null): WorkflowDoc => ({
  nodes: [
    {
      id: "etape-1",
      position: { x: 40, y: 80 },
      data: { label: "Première étape", detail: "Décrivez ce qu'il y a à faire.", kind: "agent", ...(projectId ? { project_id: projectId } : {}) },
    },
  ],
  edges: [],
});

/**
 * Turns a workflow into work: one task per step that has a project, in the
 * order of the drawing, for the person chosen on the step. Each task remembers
 * the workflow and the step it comes from. Returns how many were created.
 */
export async function launchWorkflow(workflowId: ID, doc: WorkflowDoc, about: string): Promise<number> {
  const s = get();
  if (!s.workflows[workflowId]) return 0;
  const plan = planLaunch(doc, s.projects, s.members);
  let created = 0;
  // One after the other: the tasks keep the order of the steps in their column.
  for (const planned of plan.tasks) {
    const task = await createTask({
      project_id: planned.project_id,
      title: launchTitle(planned.label, about),
      description: launchDescription(planned),
      assignee_id: planned.assignee_id,
      // A workflow launched during a meeting does not make its tasks « created in the meeting ».
      meeting_id: null,
      workflow_id: workflowId,
      workflow_step: planned.step,
    });
    if (task) created += 1;
  }
  return created;
}

export async function createWorkflow(input: { name: string; project_id?: ID | null; graph?: WorkflowDoc }) {
  const now = nowIso();
  const meId = get().meId;
  const row: Workflow = {
    id: uid(),
    name: input.name.trim() || "Nouveau workflow",
    project_id: input.project_id ?? null,
    graph: input.graph ?? starterDoc(input.project_id ?? null),
    created_by: meId,
    created_at: now,
    updated_at: now,
    updated_by: meId,
  };
  const ok = await write("workflows", row.id, row, () => getAdapter().insert("workflows", row), "Workflow non créé");
  return ok ? row : null;
}

export function updateWorkflow(id: ID, patch: Partial<Pick<Workflow, "name" | "project_id" | "graph">>) {
  const current = get().workflows[id];
  if (!current) return Promise.resolve(false);
  const next: Workflow = { ...current, ...patch, updated_at: nowIso(), updated_by: get().meId };
  return write("workflows", id, next, () => getAdapter().update("workflows", id, patch), "Workflow non enregistré");
}

export const deleteWorkflow = (id: ID) =>
  write("workflows", id, null, () => getAdapter().remove("workflows", id), "Workflow non supprimé");

export function duplicateWorkflow(id: ID) {
  const w = get().workflows[id];
  if (!w) return Promise.resolve(null);
  return createWorkflow({ name: `${w.name} (copie)`, project_id: w.project_id, graph: w.graph });
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

/** The direct conversation with a teammate, created the first time it is opened. */
export async function openDirectConversation(otherId: ID): Promise<ChatConversation | null> {
  const s = get();
  const meId = s.meId;
  if (!meId || otherId === meId) return null;
  const existing = findDirect(Object.values(s.chat_conversations), meId, otherId);
  if (existing) return existing;
  const [member_a, member_b] = directPair(meId, otherId);
  const row: ChatConversation = {
    id: uid(),
    kind: "direct",
    name: null,
    member_a,
    member_b,
    created_by: meId,
    created_at: nowIso(),
  };
  try {
    // The other person may open it at the same moment: the adapter returns whichever row exists.
    const saved = await getAdapter().openDirect(row);
    putRow("chat_conversations", saved);
    return saved;
  } catch (err) {
    toast.error("Conversation non ouverte", { description: err instanceof Error ? err.message : undefined });
    return null;
  }
}

export async function sendChatMessage(conversationId: ID, body: string): Promise<boolean> {
  const clean = body.trim();
  if (!clean || clean.length > CHAT_BODY_MAX) return false;
  const s = get();
  // The server stamps the real time. Until it answers, the message sits at the
  // end of the thread even if this device's clock runs late.
  let at = Date.now();
  for (const m of Object.values(s.chat_messages)) {
    if (m.conversation_id !== conversationId) continue;
    const t = Date.parse(m.created_at);
    if (t >= at) at = t + 1;
  }
  const row: ChatMessage = {
    id: uid(),
    conversation_id: conversationId,
    author_id: s.meId,
    body: clean,
    created_at: new Date(at).toISOString(),
    deleted_at: null,
  };
  const ok = await write("chat_messages", row.id, row, () => getAdapter().insert("chat_messages", row), "Message non envoyé");
  // Whoever writes in a conversation has read it.
  if (ok) void markChatRead(conversationId, true);
  return ok;
}

/** The author removes a message: it stays in the thread as a placeholder, without its text. */
export function deleteChatMessage(id: ID) {
  const m = get().chat_messages[id];
  if (!m || m.deleted_at) return Promise.resolve(false);
  const deleted_at = nowIso();
  return write(
    "chat_messages",
    id,
    { ...m, body: "", deleted_at },
    () => getAdapter().update("chat_messages", id, { deleted_at }),
    "Message non supprimé",
  );
}

/**
 * Records that I have read a conversation up to now. Does nothing when there
 * is nothing new, so it can be called freely while a thread is on screen.
 */
export function markChatRead(conversationId: ID, force = false) {
  const s = get();
  const meId = s.meId;
  if (!meId) return Promise.resolve(false);
  const key = participantKey(conversationId, meId);
  const current = s.chat_participants[key] as ChatParticipant | undefined;
  const messages = Object.values(s.chat_messages).filter((m) => m.conversation_id === conversationId);
  if (messages.length === 0) return Promise.resolve(true);
  if (!force && current && !messages.some((m) => isUnread(m, current.last_read_at, meId))) return Promise.resolve(true);
  // Never behind the newest message on screen, even if this device's clock runs late.
  const now = nowIso();
  const newest = messages.reduce((max, m) => (m.created_at > max ? m.created_at : max), now);
  const row: ChatParticipant = { conversation_id: conversationId, member_id: meId, last_read_at: newest };
  // A background write: a failure only means the badge comes back, it is not worth a toast.
  return write("chat_participants", key, row, () => getAdapter().insert("chat_participants", row), null);
}

/** Fetches one more page of a thread's older messages (see `chatHasOlder`). */
export async function loadOlderChatMessages(conversationId: ID): Promise<void> {
  const s = get();
  if (!s.chatHasOlder[conversationId]) return;
  const oldest = Object.values(s.chat_messages)
    .filter((m) => m.conversation_id === conversationId)
    .reduce((min, m) => (m.created_at < min ? m.created_at : min), nowIso());
  try {
    const older = await getAdapter().loadChatMessages(conversationId, oldest, CHAT_PAGE);
    set((st) => {
      const next = { ...st.chat_messages };
      for (const m of older) next[m.id] = m;
      return {
        chat_messages: next,
        chatHasOlder: older.length < CHAT_PAGE ? { ...st.chatHasOlder, [conversationId]: false } : st.chatHasOlder,
      };
    });
  } catch (err) {
    toast.error("Messages précédents non chargés", { description: err instanceof Error ? err.message : undefined });
  }
}
