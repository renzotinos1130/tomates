"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TaskLine } from "@/components/tasks/task-line";
import { formatWeekRange } from "@/lib/dates";
import { useNow, useWeekPriorities } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Figure } from "./figure";
import { Panel } from "./panel";
import { HARVEST_ORDER, Potager, StatusTomato } from "./potager";
import { useFitRows } from "./use-fit-rows";

/** A status as the legend of the patch words it, singular and plural. */
const LEGEND: Record<TaskStatus, [string, string]> = {
  done: ["terminée", "terminées"],
  review: ["en validation", "en validation"],
  in_progress: ["en cours", "en cours"],
  blocked: ["bloquée", "bloquées"],
  todo: ["à faire", "à faire"],
};

/**
 * The tile the page is built around: where the week's priorities stand. On
 * the left the score (how many are done, out of how many) and the tomato
 * patch, one tomato per priority; on the right the priorities themselves,
 * with who carries each. Changing a status in the list ripens its tomato.
 */
export function WeekHero({ className, delay }: { className?: string; delay?: number }) {
  const now = useNow();
  const { ordered } = useWeekPriorities();
  const tasksMap = useApp((s) => s.tasks);
  const rows = useFitRows<HTMLDivElement>();
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
  const legend = HARVEST_ORDER.map((status) => ({ status, count: tasks.filter((t) => t.status === status).length })).filter(
    (l) => l.count > 0,
  );

  return (
    <Panel
      className={cn("flex flex-col", className)}
      delay={delay}
      hero
      title="Priorités de la semaine"
      description="Choisies au meeting du mercredi. Une tomate par priorité : elle mûrit avec son statut."
      aside={<span className="hidden text-navy-600 @md/panel:inline">Semaine du {formatWeekRange(now)}</span>}
    >
      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <StatusTomato status="todo" size={48} />
          <p className="max-w-[340px] text-[13px] leading-5 text-navy-600">
            Aucune priorité pour l&apos;instant. Elles se choisissent pendant le{" "}
            <Link href="/meeting" className="font-medium text-navy-900 underline decoration-navy-900/25 underline-offset-2 hover:decoration-navy-900">
              meeting du mercredi
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="week-body">
          <div className="week-score">
            <div>
              <p className="flex items-baseline gap-1.5">
                <Figure value={done} className="week-figure" />
                <span className="week-total tabular">/{tasks.length}</span>
              </p>
              <p className="mt-2 text-[13px] text-navy-700">{done >= 2 ? "priorités terminées" : "priorité terminée"}</p>
            </div>
            <Potager tasks={tasks} />
            <ul className="week-legend" aria-label="Répartition des priorités">
              {legend.map((l) => (
                <li key={l.status} className="flex items-center gap-2 text-xs text-navy-700">
                  <StatusTomato status={l.status} size={16} />
                  <span>
                    <span className="font-medium text-navy-900 tabular">{l.count}</span> {LEGEND[l.status][l.count >= 2 ? 1 : 0]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div
            ref={rows}
            className="gw-rows gw-fit min-w-0 flex-1 [--fit-row:56px]"
            aria-label={`${plural(tasks.length, "priorité")} de la semaine`}
            role="group"
          >
            {sorted.map((t) => (
              <TaskLine key={t.id} task={t} show={{ lead: "status", status: false }} className="min-h-11 hover:bg-white/35" />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
