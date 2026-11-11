"use client";

import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { TaskLine } from "@/components/tasks/task-line";
import { useTaskCounts } from "@/components/tasks/use-task-counts";
import { formatShortDate, parseDateOnly } from "@/lib/dates";
import { useWeekPriorities } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Tile, TileHeader } from "./bento";

/** Priorities chosen at the last Wednesday meeting, with who owns each. */
export function WeekPriorities({ className, delay }: { className?: string; delay?: number }) {
  const { meeting, ordered } = useWeekPriorities();
  const tasksMap = useApp((s) => s.tasks);
  const counts = useTaskCounts();
  const tasks = useMemo(
    () => ordered.map((id) => tasksMap[id]).filter((t): t is Task => !!t && !t.archived_at),
    [ordered, tasksMap],
  );
  const done = tasks.filter((t) => t.status === "done").length;
  // Open first, finished at the bottom.
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done")),
    [tasks],
  );
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <Tile className={className} delay={delay}>
      <TileHeader
        title="Priorités de la semaine"
        icon={
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sun-50 text-sun-500 ring-1 ring-sun-100 ring-inset">
            <Star className="size-4 fill-sun-400" />
          </span>
        }
        hint={
          meeting
            ? `Définies au meeting du ${formatShortDate(parseDateOnly(meeting.week_start))}`
            : "Choisies pendant le meeting du mercredi"
        }
        action={
          tasks.length > 0 && (
            <div className="flex items-center gap-2.5 pt-0.5">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-leaf-500 transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-navy-700 tabular">
                {done}/{tasks.length}
              </span>
            </div>
          )
        }
      />
      <div className="px-2.5 pb-3">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Star className="size-4" />}
            title="Aucune priorité pour l'instant"
            hint="Pendant le meeting, marquez d'une étoile les tâches à accomplir avant mercredi prochain."
            action={
              <Link
                href="/meeting"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-600"
              >
                Ouvrir le meeting <ArrowRight className="size-3" />
              </Link>
            }
          />
        ) : (
          sorted.map((t) => <TaskLine key={t.id} task={t} counts={counts(t.id)} />)
        )}
      </div>
    </Tile>
  );
}
