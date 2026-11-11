"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store";
import type { ID } from "@/lib/types";

export interface TaskCounts {
  subTotal: number;
  subDone: number;
  comments: number;
}

const ZERO: TaskCounts = { subTotal: 0, subDone: 0, comments: 0 };

/** Sub-task and comment counters for every task (computed once per change). */
export function useTaskCounts(): (id: ID) => TaskCounts {
  const subtasks = useApp((s) => s.subtasks);
  const comments = useApp((s) => s.comments);
  return useMemo(() => {
    const map = new Map<ID, TaskCounts>();
    const at = (id: ID) => {
      let c = map.get(id);
      if (!c) map.set(id, (c = { subTotal: 0, subDone: 0, comments: 0 }));
      return c;
    };
    for (const s of Object.values(subtasks)) {
      const c = at(s.task_id);
      c.subTotal++;
      if (s.done) c.subDone++;
    }
    for (const cm of Object.values(comments)) at(cm.task_id).comments++;
    return (id: ID) => map.get(id) ?? ZERO;
  }, [subtasks, comments]);
}
