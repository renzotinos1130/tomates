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

/** Applies the people rules and the `updated_at` / `status_changed_at` / `completed_at` rules. */
export function withDerivedFields(prev: Task | null, next: Task, now: string): Task {
  const t = { ...next, ...settlePeople(prev, next) };
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
  { field: "status", kind: "status" },
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
