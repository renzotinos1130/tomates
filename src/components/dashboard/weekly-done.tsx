"use client";

import { useMemo, type CSSProperties } from "react";
import { formatShortDate, parseDateOnly, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow } from "@/lib/hooks";
import { weeklyDone } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { Figure } from "./figure";
import { Panel } from "./panel";

/**
 * The team's pace: tasks finished this week, against the five weeks before.
 * One bar per week (Wednesday to Tuesday); the week in progress is the teal one.
 */
export function WeeklyDone({ className, delay }: { className?: string; delay?: number }) {
  const now = useNow();
  const tasks = useAllTasks();
  const today = todayDateOnly(now);
  // Recomputed when the day changes, not every half minute.
  const weeks = useMemo(() => weeklyDone(tasks, parseDateOnly(today)), [tasks, today]);
  const current = weeks[weeks.length - 1]?.done ?? 0;
  const previous = weeks[weeks.length - 2]?.done ?? 0;
  const top = Math.max(1, ...weeks.map((w) => w.done));

  return (
    <Panel className={cn("flex flex-col", className)} delay={delay} quiet title="Terminées cette semaine">
      <p>
        <Figure value={current} />
      </p>
      <p className="mt-3 text-xs leading-5 text-navy-600">
        {previous === 0 ? "Aucune" : previous} la semaine dernière
      </p>
      <ol
        className="mt-4 flex min-h-[92px] flex-1 basis-0 items-stretch gap-1.5 @[17rem]/panel:gap-2.5"
        aria-label="Tâches terminées par semaine, de la plus ancienne à celle en cours"
      >
        {weeks.map((w, i) => {
          const last = i === weeks.length - 1;
          return (
            <li key={w.start} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="week-track" style={{ "--h": `${(w.done / top) * 100}%`, "--i": i } as CSSProperties}>
                <span className={cn("week-count", last ? "font-medium text-navy-900" : "text-navy-600")}>
                  <span className="sr-only">Semaine du {formatShortDate(parseDateOnly(w.start))} : </span>
                  {w.done}
                  <span className="sr-only"> {w.done >= 2 ? "tâches terminées" : "tâche terminée"}</span>
                </span>
                <span aria-hidden="true" className={cn("week-bar gw-pop", last ? "bg-teal-500" : "bg-navy-900/[0.16]")} />
              </span>
              <span
                aria-hidden="true"
                className={cn("text-[10.5px] leading-none whitespace-nowrap", last ? "font-medium text-navy-900" : "text-navy-600")}
              >
                {formatShortDate(parseDateOnly(w.start))}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
