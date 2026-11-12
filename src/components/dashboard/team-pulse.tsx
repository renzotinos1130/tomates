"use client";

import { useMemo } from "react";
import { formatWeekRange, parseDateOnly, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useWeek } from "@/lib/hooks";
import { taskFlow, teamKpis } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { FlowChart } from "./flow-chart";
import { Panel } from "./panel";

/**
 * The team at a glance: the four figures of the week, then whether work is
 * being closed as fast as it is added.
 */
export function TeamPulse({ className, delay }: { className?: string; delay?: number }) {
  const now = useNow();
  const week = useWeek();
  const tasks = useAllTasks();
  const today = todayDateOnly(now);
  const kpi = useMemo(() => teamKpis(tasks, today, week.startIso, null), [tasks, today, week.startIso]);
  // Recomputed when the day changes, not every second.
  const flow = useMemo(() => taskFlow(tasks, parseDateOnly(today)), [tasks, today]);

  const figures = [
    { label: "À compléter", value: kpi.open.count },
    { label: "En cours", value: kpi.inProgress.count },
    { label: "Bloquées ou en retard", value: kpi.atRisk.count, alert: kpi.atRisk.count > 0 },
    { label: "Complétées cette semaine", value: kpi.doneWeek.count },
  ];
  const any = flow[flow.length - 1]?.created > 0;

  return (
    <Panel
      className={cn("flex flex-col", className)}
      delay={delay}
      title="L'équipe"
      aside={<span className="text-navy-600">Semaine du {formatWeekRange(now)}</span>}
    >
      {/* Natural widths, as on a line of text: the long labels are never cut. */}
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 @xl/panel:flex @xl/panel:flex-wrap @xl/panel:gap-x-[34px]">
        {figures.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs leading-4 text-navy-600">
              {f.alert && <i aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-coral-500" />}
              {f.label}
            </dt>
            <dd className="mt-1 text-[21px] leading-7 font-medium tracking-[-0.03em] text-navy-900">{f.value}</dd>
          </div>
        ))}
      </dl>
      {any ? (
        <FlowChart points={flow} />
      ) : (
        <p className="py-8 text-center text-xs text-navy-600">Le rythme de l&apos;équipe se dessinera ici dès les premières tâches.</p>
      )}
    </Panel>
  );
}
