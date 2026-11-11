"use client";

import { Menu, Plus } from "lucide-react";
import { useMemo } from "react";
import { OnlineNow } from "@/components/app/page-header";
import { Kbd } from "@/components/kit/pills";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatWeekRange, isMeetingDay, todayDateOnly, weekNumber } from "@/lib/dates";
import { useAllTasks, useMe, useNow, useWeek } from "@/lib/hooks";
import { teamKpis } from "@/lib/selectors";
import { isOpen } from "@/lib/task-logic";
import { ui } from "@/lib/store";
import { firstName, plural } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { KpiTiles } from "./kpi-tiles";
import { MeetingCard } from "./meeting-card";
import { ProjectCards } from "./project-cards";
import { TeamLoad } from "./team-load";
import { WeekPriorities } from "./week-priorities";

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-navy-900">{children}</span>;
}

/** One sentence that tells the story of the week. */
function Summary() {
  const now = useNow();
  const week = useWeek();
  const tasks = useAllTasks();
  const kpi = useMemo(() => teamKpis(tasks, todayDateOnly(now), week.startIso, null), [tasks, now, week.startIso]);
  const review = tasks.filter((t) => isOpen(t) && t.status === "review").length;

  const parts: React.ReactNode[] = [];
  parts.push(
    kpi.doneWeek.count > 0 ? (
      <>
        L&apos;équipe a terminé <Strong>{plural(kpi.doneWeek.count, "tâche")}</Strong> depuis mercredi.
      </>
    ) : (
      <>La semaine commence : rien n&apos;est encore terminé depuis mercredi.</>
    ),
  );
  if (kpi.atRisk.count > 0) {
    parts.push(
      <>
        {" "}
        <Strong>{kpi.atRisk.count}</Strong> {kpi.atRisk.count > 1 ? "demandent" : "demande"} de l&apos;attention
        {review > 0 ? (
          <>
            {" "}
            et <Strong>{review}</Strong> {review > 1 ? "attendent" : "attend"} une validation.
          </>
        ) : (
          "."
        )}
      </>,
    );
  } else if (review > 0) {
    parts.push(
      <>
        {" "}
        <Strong>{review}</Strong> {review > 1 ? "attendent" : "attend"} une validation, aucun blocage.
      </>,
    );
  } else {
    parts.push(<> Aucun blocage, aucun retard.</>);
  }
  return (
    <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-navy-500">
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </p>
  );
}

export function Dashboard() {
  const now = useNow();
  const me = useMe();
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-16 sm:px-6 lg:px-8 lg:pt-10">
      {/* Mobile top row */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => ui.setMobileNav(true)}
          className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-navy-600 hover:bg-navy-900/[0.06] focus-ring"
        >
          <Menu className="size-5" />
        </button>
        <OnlineNow />
      </div>

      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-navy-500">
            <span className="font-medium text-navy-800">{formatLongDate(now)}</span>
            <span className="text-navy-200">·</span>
            <span>Semaine {weekNumber(now)}</span>
            <span className="text-navy-200">·</span>
            <span>{formatWeekRange(now)}</span>
            {isMeetingDay(now) && (
              <span className="rounded-full bg-sun-100 px-2 py-0.5 text-[11px] font-medium text-sun-800">
                Jour de meeting
              </span>
            )}
          </p>
          <h1 className="mt-2 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-navy-900 sm:text-[38px]">
            {hello}
            {me ? `, ${firstName(me.full_name)}` : ""}
          </h1>
          <Summary />
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <OnlineNow />
          <Button onClick={() => ui.openQuickAdd()} size="lg" className="shadow-button">
            <Plus /> Nouvelle tâche
            <Kbd className="ml-1 border-white/20 bg-white/10 text-white">C</Kbd>
          </Button>
        </div>
      </header>

      <div className="mt-7 space-y-3 sm:space-y-4">
        <KpiTiles />

        <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
          <WeekPriorities className="xl:col-span-8" delay={200} />
          <MeetingCard className="xl:col-span-4" delay={240} />
        </div>

        <ProjectCards delay={280} />

        <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
          <TeamLoad className="xl:col-span-4" delay={420} />
          <ActivityFeed className="xl:col-span-8" delay={460} limit={8} />
        </div>
      </div>
    </main>
  );
}
