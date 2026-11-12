"use client";

import { Menu, Plus } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { useMemo } from "react";
import { OnlineNow } from "@/components/app/page-header";
import { Kbd } from "@/components/kit/pills";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatWeekRange, isMeetingDay, todayDateOnly, weekNumber } from "@/lib/dates";
import { useAllTasks, useMe, useNow, useWeek, useWeekPriorities } from "@/lib/hooks";
import { ui } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import { cn, firstName, plural } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { KpiTiles } from "./kpi-tiles";
import { MeetingCard } from "./meeting-card";
import { ProjectCards } from "./project-cards";
import { TeamLoad } from "./team-load";
import { WeekPriorities } from "./week-priorities";

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-navy-900 tabular">{children}</span>;
}

/**
 * What is on my plate, in one sentence. The team's figures sit right below:
 * the greeting talks to the person, the strip talks about the team.
 */
function Summary() {
  const now = useNow();
  const me = useMe();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const today = todayDateOnly(now);

  const mine = useMemo(() => tasks.filter((t) => isOpen(t) && t.assignee_id === me?.id), [tasks, me?.id]);
  const priorities = mine.filter((t) => priorityIds.has(t.id)).length;
  const late = mine.filter((t) => isOverdue(t, today)).length;
  const blocked = mine.filter((t) => t.status === "blocked").length;

  if (mine.length === 0) {
    return <p className="inline text-navy-900/55">Rien ne vous attend pour l&apos;instant.</p>;
  }
  const be = (n: number) => (n >= 2 ? "sont" : "est");
  return (
    <p className="inline text-navy-900/55">
      Vous avez <Strong>{plural(mine.length, "tâche ouverte", "tâches ouvertes")}</Strong>
      {priorities > 0 && (
        <>
          , dont <Strong>{plural(priorities, "priorité")}</Strong> de la semaine
        </>
      )}
      .
      {late > 0 && (
        <>
          {" "}
          <Strong>{late}</Strong> {be(late)} en retard
          {blocked > 0 ? (
            <>
              {" "}
              et <Strong>{blocked}</Strong> {be(blocked)} {blocked >= 2 ? "bloquées" : "bloquée"}.
            </>
          ) : (
            "."
          )}
        </>
      )}
      {late === 0 && blocked > 0 && (
        <>
          {" "}
          <Strong>{blocked}</Strong> {be(blocked)} {blocked >= 2 ? "bloquées" : "bloquée"}.
        </>
      )}
    </p>
  );
}

/** The Wed → Tue week as seven blocks: the days gone by, today in tomato, the days to come. */
function WeekStrip() {
  const now = useNow();
  const week = useWeek();
  const day = Math.min(6, Math.max(0, differenceInCalendarDays(now, week.start)));
  return (
    <span
      role="img"
      aria-label={`Jour ${day + 1} sur 7 de la semaine`}
      title={`Jour ${day + 1} sur 7 de la semaine (mercredi → mardi)`}
      className="inline-flex gap-[3px]"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-[1px]",
            i < day ? "bg-navy-900/40" : i === day ? "bg-tomato-500" : "bg-navy-900/[0.14]",
          )}
        />
      ))}
    </span>
  );
}

export function Dashboard() {
  const now = useNow();
  const me = useMe();
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <main className="w-full max-w-[1520px] px-4 pt-4 pb-12 sm:px-6 lg:px-8 lg:pt-6">
      {/* Mobile top row */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => ui.setMobileNav(true)}
          className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-navy-700 hover:bg-white/50 focus-ring"
        >
          <Menu className="size-5" />
        </button>
        <OnlineNow />
      </div>

      <header className="gw-reveal">
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-navy-500">
            <span className="font-medium text-navy-800">{formatLongDate(now)}</span>
            <span aria-hidden="true" className="text-navy-300">
              ·
            </span>
            <span>semaine {weekNumber(now)}</span>
            <WeekStrip />
            <span>{formatWeekRange(now)}</span>
            {isMeetingDay(now) && (
              <span className="inline-flex items-center gap-1.5 font-medium text-sun-800">
                <span aria-hidden="true" className="size-1.5 rounded-[1px] bg-sun-400" />
                Jour de meeting
              </span>
            )}
          </p>
          <div className="hidden items-center gap-3 lg:flex">
            <OnlineNow />
            <Button variant="tomato" onClick={() => ui.openQuickAdd()}>
              <Plus /> Nouvelle tâche
              <Kbd className="ml-1 border-white/20 bg-white/10 text-white">C</Kbd>
            </Button>
          </div>
        </div>
        {/* The week in one statement: the greeting, then what the numbers say. */}
        <div className="mt-4 max-w-[54rem] text-[22px] leading-[1.32] tracking-[-0.02em] sm:mt-5 sm:text-[28px]">
          <h1 className="inline font-semibold text-navy-900">
            {hello}
            {me ? `, ${firstName(me.full_name)}` : ""}.
          </h1>{" "}
          <Summary />
        </div>
      </header>

      <div className="mt-6 space-y-3 sm:mt-7 sm:space-y-4">
        <KpiTiles />

        <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
          <WeekPriorities className="xl:col-span-8" delay={200} />
          <MeetingCard className="xl:col-span-4 xl:self-start" delay={240} />
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
