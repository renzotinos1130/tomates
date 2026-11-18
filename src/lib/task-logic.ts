/**
 * Business rules shared by the optimistic client store and the demo adapter.
 * They mirror the Postgres triggers in `supabase/migrations` so the UI shows
 * the same result before and after the server round-trip.
 */
import type { ID, Task, TaskEvent, TaskEventKind } from "./types";
import { uid } from "./utils";

type People = { assignee_id?: ID | null; assignee_ids?: ID[] | null };

/**
 * Everyone a task (or a workflow step) is given to. What was saved before a
 * task could have several people only names one: that is a list of one.
 */
export function assigneesOf(row: People | null | undefined): ID[] {
  if (!row) return [];
  return row.assignee_ids ?? (row.assignee_id ? [row.assignee_id] : []);
}

export const isAssignedTo = (row: People, memberId: ID | null | undefined): boolean => !!memberId && assigneesOf(row).includes(memberId);

const sameList = (a: ID[], b: ID[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * The people of a task after a write, as the database settles them
 * (tasks_sync_assignees): the list is what counts; a write that only names
 * « the » person makes a list of one; nobody is listed twice; `assignee_id` is
 * the first of the list.
 */
function settlePeople(prev: Task | null, next: Task): Pick<Task, "assignee_id" | "assignee_ids"> {
  const before = assigneesOf(prev);
  let list = next.assignee_ids ?? (prev ? before : []);
  const onlyTheOldField = prev
    ? sameList(list, before) && (next.assignee_id ?? null) !== (prev.assignee_id ?? before[0] ?? null)
    : list.length === 0 && !!next.assignee_id;
  if (onlyTheOldField) list = next.assignee_id ? [next.assignee_id] : [];
  const people = [...new Set(list.filter(Boolean))];
  return { assignee_ids: people, assignee_id: people[0] ?? null };
}

/* ------------------------------------------------------------------ */
/* Dependencies: a task waits for the tasks it depends on              */
/* ------------------------------------------------------------------ */

/** Reads a task by its id: from the store, from the demo database… */
export type TaskLookup = (id: ID) => Task | undefined;

/** A task still to do holds back those that depend on it. Finished, archived or gone, it holds nobody. */
export const holdsOthers = (t: Task | undefined): t is Task => !!t && t.status !== "done" && !t.archived_at;

/** The tasks this one depends on that are still to do. */
export function pendingDependencies(task: Pick<Task, "depends_on">, find: TaskLookup): Task[] {
  return (task.depends_on ?? []).map(find).filter(holdsOthers);
}

/** Blocked because someone said so, not because it waits its turn: what needs a hand. */
export const isStuck = (t: Pick<Task, "status" | "waiting">): boolean => t.status === "blocked" && !t.waiting;

/** Would `taskId` depending on `otherId` close a circle? True when `otherId` already waits for it, however far down the line. */
export function wouldLoop(taskId: ID, otherId: ID, find: TaskLookup): boolean {
  const seen = new Set<ID>();
  const todo = [otherId];
  while (todo.length) {
    const id = todo.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    todo.push(...(find(id)?.depends_on ?? []));
  }
  return false;
}

/**
 * The wait of a task after a write, as the database settles it (tasks_await):
 * the list is cleaned; while a task on it is still to do the task is kept
 * « blocked » and marked as waiting, whatever status was asked for; once
 * nothing holds it any more, it goes back to « todo » by itself. A task that
 * was already finished stays finished.
 */
function settleWait(prev: Task | null, next: Task, find: TaskLookup): Pick<Task, "depends_on" | "waiting" | "status"> {
  const before = prev?.depends_on ?? [];
  let list = next.depends_on ?? before;
  if (!prev || !sameList(list, before)) list = [...new Set(list.filter((id) => !!id && id !== next.id && !!find(id)))];
  let held = list.some((id) => holdsOthers(find(id)));
  let status = next.status;
  if (prev) {
    if (prev.status === "done" && status === "done") held = false;
    if (!held && prev.waiting && prev.status === "blocked" && status === "blocked") status = "todo";
  }
  if (held) status = "blocked";
  return { depends_on: list, waiting: held, status };
}

/**
 * The tasks to settle once `prev` has become `next` (null: it was deleted), as
 * the database does (tasks_release_dependents): those that depend on it and
 * are freed, or wait again. `find` must already see the change. Returns each
 * of them as it now is.
 */
export function settleDependents(prev: Task, next: Task | null, all: Iterable<Task>, find: TaskLookup, now: string): Task[] {
  const out: Task[] = [];
  if (next && holdsOthers(prev) === holdsOthers(next)) return out;
  for (const t of all) {
    if (t.id === prev.id || !(t.depends_on ?? []).includes(prev.id)) continue;
    if (!next) {
      out.push(withDerivedFields(t, { ...t, depends_on: t.depends_on.filter((id) => id !== prev.id) }, now, find));
    } else if (t.status !== "done") {
      const settled = withDerivedFields(t, t, now, find);
      if (settled.status !== t.status || settled.waiting !== t.waiting) out.push(settled);
    }
  }
  return out;
}

/**
 * Applies the people rules, the rules of waiting (when `find` gives a view of
 * the other tasks) and the `updated_at` / `status_changed_at` / `completed_at` rules.
 */
export function withDerivedFields(prev: Task | null, next: Task, now: string, find?: TaskLookup): Task {
  const t = { ...next, ...settlePeople(prev, next) };
  t.depends_on = t.depends_on ?? prev?.depends_on ?? [];
  t.waiting = t.waiting ?? false;
  if (find) Object.assign(t, settleWait(prev, t, find));
  if (!prev) {
    t.status_changed_at = t.status_changed_at || now;
    t.completed_at = t.status === "done" ? (t.completed_at ?? now) : null;
    return t;
  }
  t.updated_at = now;
  if (prev.status !== t.status) {
    t.status_changed_at = now;
    if (t.status === "done") t.completed_at = now;
  }
  if (t.status !== "done") t.completed_at = null;
  return t;
}

const TRACKED: { field: keyof Task; kind: TaskEventKind }[] = [
  { field: "priority", kind: "priority" },
  { field: "due_date", kind: "due_date" },
  { field: "title", kind: "title" },
  { field: "project_id", kind: "project" },
];

/** Events produced by a task insert/update (same as the SQL trigger). */
export function diffTaskEvents(
  prev: Task | null,
  next: Task,
  actorId: ID | null,
  now: string,
): TaskEvent[] {
  const base = { task_id: next.id, project_id: next.project_id, actor_id: actorId };
  if (!prev) {
    return [
      {
        ...base,
        id: uid(),
        kind: "created",
        old_value: null,
        new_value: next.title,
        created_at: next.created_at,
      },
    ];
  }
  const events: TaskEvent[] = [];
  const dependsBefore = prev.depends_on ?? [];
  const dependsAfter = next.depends_on ?? [];
  const listChanged = !sameList(dependsBefore, dependsAfter);
  // A task held back by another is logged as « waiting », not « blocked »: nobody reported a problem.
  // When the wait comes from its list being changed, the « dependency » line below says it all.
  if (prev.status !== next.status && !(next.waiting && listChanged)) {
    events.push({ ...base, id: uid(), kind: "status", old_value: prev.status, new_value: next.waiting ? "waiting" : next.status, created_at: now });
  }
  for (const { field, kind } of TRACKED) {
    const a = prev[field] as string | null;
    const b = next[field] as string | null;
    if ((a ?? null) !== (b ?? null)) {
      events.push({ ...base, id: uid(), kind, old_value: a ?? null, new_value: b ?? null, created_at: now });
    }
  }
  // The people before and after, as lists (ids separated by commas, null for nobody).
  const before = assigneesOf(prev);
  const after = assigneesOf(next);
  if (!sameList(before, after)) {
    events.push({ ...base, id: uid(), kind: "assignee", old_value: before.join(",") || null, new_value: after.join(",") || null, created_at: now });
  }
  if (listChanged) {
    events.push({ ...base, id: uid(), kind: "dependency", old_value: dependsBefore.join(",") || null, new_value: dependsAfter.join(",") || null, created_at: now });
  }
  if (!prev.archived_at && next.archived_at) {
    events.push({ ...base, id: uid(), kind: "archived", old_value: null, new_value: null, created_at: now });
  } else if (prev.archived_at && !next.archived_at) {
    events.push({ ...base, id: uid(), kind: "unarchived", old_value: null, new_value: null, created_at: now });
  }
  return events;
}

export function isOpen(t: Task): boolean {
  return t.status !== "done" && !t.archived_at;
}

export function isOverdue(t: Task, today: string): boolean {
  return !!t.due_date && t.status !== "done" && !t.archived_at && t.due_date < today;
}
