/**
 * Business rules shared by the optimistic client store and the demo adapter.
 * They mirror the Postgres triggers in `supabase/migrations` so the UI shows
 * the same result before and after the server round-trip.
 */
import type { ID, Task, TaskEvent, TaskEventKind } from "./types";
import { uid } from "./utils";

/** Applies `updated_at` / `status_changed_at` / `completed_at` rules. */
export function withDerivedFields(prev: Task | null, next: Task, now: string): Task {
  const t = { ...next };
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
  { field: "assignee_id", kind: "assignee" },
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
