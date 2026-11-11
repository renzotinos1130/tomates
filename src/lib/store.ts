"use client";

/**
 * Client store. Holds the whole workspace in memory (a small team has a few
 * hundred tasks), applies every mutation optimistically, persists it through
 * the adapter, and merges realtime changes coming from teammates.
 */
import { toast } from "sonner";
import { create } from "zustand";
import { rowKey, TABLES, type Change, type DataAdapter, type PresenceState } from "./data/adapter";
import { weekStartDateOnly } from "./dates";
import { isSupabaseConfigured } from "./supabase/config";
import { buildMeetingSummary, editablePriorityMeeting, prioritiesFor } from "./selectors";
import { withDerivedFields } from "./task-logic";
import type {
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
  TaskEvent,
  TaskPriority,
  TaskStatus,
  Workflow,
  WorkflowDoc,
} from "./types";
import { nowIso, positionBetween, slugify, uid } from "./utils";

type Tables = { [K in TableName]: Record<string, RowOf<K>> };

export type BootStatus = "booting" | "ready" | "pending-access" | "error";

export interface QuickAddDefaults {
  project_id?: ID;
  assignee_id?: ID | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  weekPriority?: boolean;
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
  confirm: ConfirmRequest | null;
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
  confirm: null,
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
  set({ ...tables });
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
    if (c.table === "members" && c.row && (c.row as Member).id === get().meId && !(c.row as Member).active) {
      set({ status: "pending-access" });
    }
  }
}

export function setPresence(states: PresenceState[]) {
  set({ presence: states });
}

/* ------------------------------------------------------------------ */
/* Generic optimistic write                                            */
/* ------------------------------------------------------------------ */

async function write<T extends TableName>(
  table: T,
  key: string,
  optimistic: RowOf<T> | null,
  run: () => Promise<RowOf<T> | void>,
  errorLabel: string,
): Promise<boolean> {
  const before = get()[table][key] as RowOf<T> | undefined;
  const id = pk(table, key);
  pending.set(id, (pending.get(id) ?? 0) + 1);
  if (optimistic) putRow(table, optimistic);
  else dropRow(table, key);
  try {
    const saved = await run();
    if (saved) putRow(table, saved);
    return true;
  } catch (err) {
    if (before) putRow(table, before);
    else dropRow(table, key);
    toast.error(errorLabel, { description: err instanceof Error ? err.message : undefined });
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

export const ui = {
  openTask: (id: ID | null) => set({ openTaskId: id }),
  openQuickAdd: (defaults: QuickAddDefaults = {}) => set({ quickAdd: { open: true, defaults } }),
  closeQuickAdd: () => set((s) => ({ quickAdd: { ...s.quickAdd, open: false } })),
  setCommandOpen: (open: boolean) => set({ commandOpen: open }),
  setMobileNav: (open: boolean) => set({ mobileNavOpen: open }),
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
    },
    now,
  );
  const ok = await write("tasks", task.id, task, () => getAdapter().insert("tasks", task), "Impossible de créer la tâche");
  if (!ok) return null;
  if (input.weekPriority) await setWeekPriority(task.id, true);
  return get().tasks[task.id] ?? task;
}

export function updateTask(id: ID, patch: Partial<Task>) {
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

export function deleteTask(id: ID) {
  return write("tasks", id, null, () => getAdapter().remove("tasks", id), "Suppression impossible");
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

const STARTER_DOC: WorkflowDoc = {
  nodes: [
    {
      id: "depart",
      position: { x: 40, y: 80 },
      data: { label: "Point de départ", detail: "Ce qui déclenche ce workflow.", kind: "trigger" },
    },
  ],
  edges: [],
};

export async function createWorkflow(input: { name: string; project_id?: ID | null; graph?: WorkflowDoc }) {
  const now = nowIso();
  const meId = get().meId;
  const row: Workflow = {
    id: uid(),
    name: input.name.trim() || "Nouveau workflow",
    project_id: input.project_id ?? null,
    graph: input.graph ?? STARTER_DOC,
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
