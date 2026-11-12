"use client";

import { addDays, format } from "date-fns";
import { useMemo } from "react";
import { AvatarStack } from "@/components/kit/member-avatar";
import { locale, todayDateOnly, toDateOnly } from "@/lib/dates";
import { useAllTasks, useMe, useMembers, useNow, useWeek } from "@/lib/hooks";
import { teamKpis } from "@/lib/selectors";
import { isOpen } from "@/lib/task-logic";
import { cn, plural } from "@/lib/utils";
import { Tile } from "./bento";

/** Hairlines between the four figures: a 2 × 2 grid on small screens, one row on large ones. */
const DIVIDERS = [
  "",
  "border-l",
  "border-t xl:border-t-0 xl:border-l",
  "border-t border-l xl:border-t-0",
];

function Figure({
  index,
  label,
  value,
  alert = false,
  children,
}: {
  index: number;
  label: string;
  value: number;
  /** Draws the number in the "needs attention" colour. */
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col border-navy-900/[0.07] px-4.5 py-4 sm:px-5 sm:py-4.5", DIVIDERS[index])}>
      <dt className="min-h-8 text-xs leading-4 font-medium text-navy-500 sm:min-h-0">{label}</dt>
      <dd
        className={cn(
          "mt-2 text-[32px] leading-none font-semibold tracking-[-0.03em] tabular",
          alert ? "text-coral-600" : "text-navy-900",
        )}
      >
        {value}
      </dd>
      <dd className="mt-auto flex min-h-9 items-end pt-3 text-xs text-muted-foreground">{children}</dd>
    </div>
  );
}

const DAY_BLOCKS = 4;

/** The four numbers that summarise the team's week, on one strip. */
export function KpiTiles() {
  const now = useNow();
  const week = useWeek();
  const me = useMe();
  const members = useMembers();
  const tasks = useAllTasks();
  const today = todayDateOnly(now);

  const kpi = useMemo(() => teamKpis(tasks, today, week.startIso, me?.id ?? null), [tasks, today, week.startIso, me?.id]);

  const unassigned = useMemo(() => tasks.filter((t) => isOpen(t) && !t.assignee_id).length, [tasks]);
  const busy = useMemo(() => {
    const ids = new Set(
      tasks.filter((t) => isOpen(t) && (t.status === "in_progress" || t.status === "review")).map((t) => t.assignee_id),
    );
    return members.filter((m) => ids.has(m.id));
  }, [tasks, members]);

  // Completed tasks per day of the Wed → Tue week.
  const days = useMemo(() => {
    const counts = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(week.start, i);
      return {
        key: toDateOnly(d),
        letter: format(d, "EEEEE", { locale }).toUpperCase(),
        name: format(d, "EEEE", { locale }),
        count: 0,
      };
    });
    for (const t of tasks) {
      if (t.status !== "done" || !t.completed_at || t.completed_at < week.startIso) continue;
      const slot = counts.find((c) => c.key === toDateOnly(new Date(t.completed_at as string)));
      if (slot) slot.count++;
    }
    return counts;
  }, [tasks, week.start, week.startIso]);
  const rhythm = days
    .filter((d) => d.count > 0)
    .map((d) => `${d.name} : ${d.count}`)
    .join(", ");

  return (
    <Tile delay={40}>
      <dl className="grid grid-cols-2 xl:grid-cols-4">
        <Figure index={0} label="À compléter" value={kpi.open.count}>
          {unassigned > 0 ? (
            <span>
              dont <span className="font-medium text-navy-800">{unassigned}</span> sans responsable
            </span>
          ) : (
            "Toutes ont un responsable"
          )}
        </Figure>

        <Figure index={1} label="En cours" value={kpi.inProgress.count}>
          {busy.length > 0 ? <AvatarStack members={busy} size="sm" max={6} /> : "Personne pour l'instant"}
        </Figure>

        <Figure index={2} label="Bloquées ou en retard" value={kpi.atRisk.count} alert={kpi.atRisk.count > 0}>
          {kpi.atRisk.count > 0 ? (
            <span>
              {plural(kpi.atRisk.blocked, "bloquée")} · {kpi.atRisk.overdue} en retard
            </span>
          ) : (
            "Tout roule"
          )}
        </Figure>

        <Figure index={3} label="Complétées cette semaine" value={kpi.doneWeek.count}>
          {/* One block per finished task, stacked on the day it was done. */}
          <div
            className="flex items-end gap-2"
            role="img"
            aria-label={rhythm ? `Par jour — ${rhythm}` : "Aucune tâche terminée cette semaine"}
          >
            {days.map((d) => (
              <div key={d.key} className="flex w-2.5 flex-col items-center gap-1" title={`${d.name} : ${d.count}`}>
                <div className="flex flex-col-reverse gap-0.5">
                  {d.count === 0 ? (
                    <span className={cn("size-2 rounded-[2px]", d.key === today ? "bg-navy-900/25" : "bg-navy-900/10")} />
                  ) : (
                    Array.from({ length: Math.min(d.count, DAY_BLOCKS) }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2 rounded-[2px]",
                          d.count > DAY_BLOCKS && i === DAY_BLOCKS - 1 ? "bg-leaf-700" : "bg-leaf-500",
                        )}
                      />
                    ))
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] leading-none",
                    d.key === today ? "font-semibold text-navy-900" : "text-navy-400",
                  )}
                >
                  {d.letter}
                </span>
              </div>
            ))}
          </div>
        </Figure>
      </dl>
    </Tile>
  );
}
