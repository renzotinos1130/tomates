"use client";

import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { STATUSES } from "@/lib/constants";
import { compareTasks, type SortKey } from "@/lib/selectors";
import { moveTask, setStatus } from "@/lib/store";
import type { ID, Task, TaskPriority, TaskStatus } from "@/lib/types";

export interface BoardFilters {
  assignees: (ID | "none")[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  query: string;
  showArchived: boolean;
}

export const EMPTY_FILTERS: BoardFilters = {
  assignees: [],
  statuses: [],
  priorities: [],
  query: "",
  showArchived: false,
};

export function activeFilterCount(f: BoardFilters) {
  return f.assignees.length + f.statuses.length + f.priorities.length + (f.query.trim() ? 1 : 0);
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function matchesFilters(t: Task, f: BoardFilters): boolean {
  if (f.assignees.length && !f.assignees.includes(t.assignee_id ?? "none")) return false;
  if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
  if (f.query.trim() && !norm(t.title).includes(norm(f.query.trim()))) return false;
  return true;
}

export type Columns = Record<TaskStatus, ID[]>;
const COL_PREFIX = "col:";
export const columnId = (s: TaskStatus) => `${COL_PREFIX}${s}`;
const isColumnId = (id: string) => id.startsWith(COL_PREFIX);

/**
 * Everything the two project views share: filtering, sorting, grouping by
 * status and the drag & drop choreography. The table and the kanban render
 * the same `columns`, so a task is always in sync between the views.
 */
export function useBoard(tasks: Task[], filters: BoardFilters, sort: SortKey) {
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const visibleStatuses = useMemo(
    () => (filters.statuses.length ? STATUSES.filter((s) => filters.statuses.includes(s)) : STATUSES),
    [filters.statuses],
  );

  const base = useMemo<Columns>(() => {
    const cols: Columns = { todo: [], in_progress: [], review: [], blocked: [], done: [] };
    const cmp = compareTasks(sort);
    const list = tasks.filter((t) => !t.archived_at && matchesFilters(t, filters)).sort(cmp);
    for (const t of list) cols[t.status].push(t.id);
    return cols;
  }, [tasks, filters, sort]);

  const archived = useMemo(
    () =>
      filters.showArchived
        ? tasks
            .filter((t) => t.archived_at && matchesFilters(t, filters))
            .sort((a, b) => ((a.archived_at ?? "") < (b.archived_at ?? "") ? 1 : -1))
        : [],
    [tasks, filters],
  );

  /* --------------------------- drag & drop --------------------------- */

  const [activeId, setActiveId] = useState<ID | null>(null);
  const [override, setOverride] = useState<Columns | null>(null);
  const columns = override ?? base;
  // Latest columns for the drag handlers (read in events, never in render).
  const columnsRef = useRef(columns);
  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = useCallback((id: string | null | undefined): TaskStatus | null => {
    if (!id) return null;
    if (isColumnId(id)) return id.slice(COL_PREFIX.length) as TaskStatus;
    const cols = columnsRef.current;
    return (Object.keys(cols) as TaskStatus[]).find((s) => cols[s].includes(id)) ?? null;
  }, []);

  // Prefer what is under the pointer (works for empty / collapsed columns).
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    if (hits.length) {
      const item = hits.find((h) => !isColumnId(String(h.id)));
      return item ? [item] : hits;
    }
    return closestCorners(args);
  }, []);

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      setActiveId(String(e.active.id));
      setOverride(base);
    },
    [base],
  );

  const onDragOver = useCallback(
    (e: DragOverEvent) => {
      const active = String(e.active.id);
      const over = e.over ? String(e.over.id) : null;
      const from = findColumn(active);
      const to = findColumn(over);
      if (!from || !to || from === to) return;
      setOverride((prev) => {
        const cols = prev ?? base;
        if (!cols[from].includes(active)) return prev;
        const target = cols[to].filter((id) => id !== active);
        const overIndex = over && !isColumnId(over) ? target.indexOf(over) : -1;
        const index = overIndex >= 0 ? overIndex : target.length;
        return {
          ...cols,
          [from]: cols[from].filter((id) => id !== active),
          [to]: [...target.slice(0, index), active, ...target.slice(index)],
        };
      });
    },
    [base, findColumn],
  );

  const reset = useCallback(() => {
    setActiveId(null);
    setOverride(null);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const active = String(e.active.id);
      const over = e.over ? String(e.over.id) : null;
      const task = byId.get(active);
      const to = findColumn(over) ?? findColumn(active);
      if (!task || !to) return reset();

      if (sort !== "manual") {
        // Sorted views keep their order: dragging only changes the status.
        if (to !== task.status) void setStatus(active, to);
        return reset();
      }

      const cols = columnsRef.current;
      let ids = cols[to].includes(active) ? cols[to] : [...cols[to], active];
      const oldIndex = ids.indexOf(active);
      const newIndex = over && !isColumnId(over) && ids.includes(over) ? ids.indexOf(over) : oldIndex;
      ids = arrayMove(ids, oldIndex, newIndex);
      const at = ids.indexOf(active);
      const before = at > 0 ? ids[at - 1] : null;
      const after = at < ids.length - 1 ? ids[at + 1] : null;
      const unchanged = to === task.status && base[to].join() === ids.join();
      if (!unchanged) void moveTask(active, to, before, after);
      reset();
    },
    [byId, findColumn, sort, base, reset],
  );

  return {
    byId,
    columns,
    archived,
    visibleStatuses,
    activeTask: activeId ? (byId.get(activeId) ?? null) : null,
    dnd: { sensors, collisionDetection, onDragStart, onDragOver, onDragEnd, onDragCancel: reset },
  };
}

export type Board = ReturnType<typeof useBoard>;
