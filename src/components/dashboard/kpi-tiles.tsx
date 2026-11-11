"use client";

import { addDays, format } from "date-fns";
import { CheckCheck, CircleDashed, OctagonAlert, Zap } from "lucide-react";
import { useMemo } from "react";
import { AvatarStack } from "@/components/kit/member-avatar";
import { locale, todayDateOnly, toDateOnly } from "@/lib/dates";
import { useAllTasks, useMe, useMembers, useNow, useWeek } from "@/lib/hooks";
import { teamKpis } from "@/lib/selectors";
import { isOpen } from "@/lib/task-logic";
import { cn } from "@/lib/utils";
import { Tile } from "./bento";

function Kpi({
  label,
  value,
  icon,
  tone,
  footer,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  footer: React.ReactNode;
  delay: number;
}) {
  return (
    <Tile delay={delay} className="flex flex-col p-4.5 sm:p-5">
      <div className="flex min-h-8 items-center gap-2 sm:min-h-0">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone)}>{icon}</span>
        <span className="line-clamp-2 text-[12.5px] leading-tight font-medium text-navy-600">{label}</span>
      </div>
      <div className="mt-3 text-[34px] leading-none font-semibold tracking-tight text-navy-900">{value}</div>
      <div className="mt-3 flex min-h-5 items-center text-xs text-muted-foreground">{footer}</div>
    </Tile>
  );
}

/** The four numbers that summarise the team's week. */
export function KpiTiles() {
  const now = useNow();
  const week = useWeek();
  const me = useMe();
  const members = useMembers();
  const tasks = useAllTasks();
  const today = todayDateOnly(now);

  const kpi = useMemo(() => teamKpis(tasks, today, week.startIso, me?.id ?? null), [tasks, today, week.startIso, me?.id]);

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
      return { key: toDateOnly(d), label: format(d, "EEEEE", { locale }).toUpperCase(), count: 0 };
    });
    for (const t of tasks) {
      if (t.status !== "done" || !t.completed_at || t.completed_at < week.startIso) continue;
      const slot = counts.find((c) => c.key === toDateOnly(new Date(t.completed_at as string)));
      if (slot) slot.count++;
    }
    return counts;
  }, [tasks, week.start, week.startIso]);
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Kpi
        delay={40}
        label="À compléter"
        value={kpi.open.count}
        tone="bg-navy-100 text-navy-600"
        icon={<CircleDashed className="size-3.5" />}
        footer={
          kpi.open.mine > 0 ? (
            <span>
              dont <span className="font-medium text-navy-800">{kpi.open.mine}</span> pour vous
            </span>
          ) : (
            "Rien ne vous attend"
          )
        }
      />
      <Kpi
        delay={80}
        label="En cours"
        value={kpi.inProgress.count}
        tone="bg-teal-50 text-teal-600"
        icon={<Zap className="size-3.5" />}
        footer={busy.length > 0 ? <AvatarStack members={busy} size="sm" max={6} /> : "Personne pour l'instant"}
      />
      <Kpi
        delay={120}
        label="Bloquées ou en retard"
        value={kpi.atRisk.count}
        tone={kpi.atRisk.count > 0 ? "bg-coral-50 text-coral-600" : "bg-leaf-50 text-leaf-600"}
        icon={<OctagonAlert className="size-3.5" />}
        footer={
          kpi.atRisk.count > 0 ? (
            <span>
              {kpi.atRisk.blocked} bloquée{kpi.atRisk.blocked > 1 ? "s" : ""} · {kpi.atRisk.overdue} en retard
            </span>
          ) : (
            "Tout roule"
          )
        }
      />
      <Kpi
        delay={160}
        label="Complétées cette semaine"
        value={kpi.doneWeek.count}
        tone="bg-leaf-50 text-leaf-600"
        icon={<CheckCheck className="size-3.5" />}
        footer={
          <div className="flex w-full items-end gap-1" aria-hidden="true">
            {days.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={`${d.count}`}>
                <div className="flex h-4 w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-[3px] transition-all duration-500",
                      d.count > 0 ? "bg-leaf-400" : "bg-navy-100",
                      d.key === today && d.count === 0 && "bg-navy-200",
                    )}
                    style={{ height: d.count > 0 ? `${Math.max(25, (d.count / maxDay) * 100)}%` : "3px" }}
                  />
                </div>
                <span className={cn("text-[9px] leading-none", d.key === today ? "font-semibold text-navy-800" : "text-navy-400")}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        }
      />
    </div>
  );
}
