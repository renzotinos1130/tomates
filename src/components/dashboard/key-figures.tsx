"use client";

import { useMemo } from "react";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useWeek } from "@/lib/hooks";
import { teamKpis } from "@/lib/selectors";
import { cn } from "@/lib/utils";

/** The four numbers that summarise the team's week. Just the numbers. */
export function KeyFigures({ className }: { className?: string }) {
  const now = useNow();
  const week = useWeek();
  const tasks = useAllTasks();
  const today = todayDateOnly(now);
  const kpi = useMemo(() => teamKpis(tasks, today, week.startIso, null), [tasks, today, week.startIso]);

  const figures = [
    { label: "À compléter", value: kpi.open.count },
    { label: "En cours", value: kpi.inProgress.count },
    { label: "Bloquées ou en retard", value: kpi.atRisk.count, alert: kpi.atRisk.count > 0 },
    { label: "Complétées cette semaine", value: kpi.doneWeek.count },
  ];

  return (
    <dl className={cn("gw-reveal grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4", className)} style={{ animationDelay: "60ms" }}>
      {figures.map((f) => (
        <div key={f.label} className="flex flex-col-reverse justify-end">
          <dt className="mt-2 text-xs leading-4 text-navy-500">{f.label}</dt>
          <dd
            className={cn(
              "text-[28px] leading-none font-semibold tracking-[-0.03em] tabular",
              f.alert ? "text-coral-600" : "text-navy-900",
            )}
          >
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
