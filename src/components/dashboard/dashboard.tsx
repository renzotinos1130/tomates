"use client";

import { Menu, Plus } from "lucide-react";
import { useMemo } from "react";
import { OnlineNow } from "@/components/app/page-header";
import { capitalize, formatLongDate, todayDateOnly, weekNumber } from "@/lib/dates";
import { useAllTasks, useMe, useNow, useWeekPriorities } from "@/lib/hooks";
import { ui } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import { firstName, plural } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { KeyFigures } from "./key-figures";
import { MeetingCard } from "./meeting-card";
import { ProjectCards } from "./project-cards";
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

export function Dashboard() {
  const now = useNow();
  const me = useMe();
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <main className="w-full max-w-[1180px] px-4 pt-4 pb-16 sm:px-6 lg:px-10 lg:pt-9">
      {/* Mobile top row */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => ui.setMobileNav(true)}
          className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-navy-700 hover:bg-navy-900/[0.05] focus-ring"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <OnlineNow />
          <button
            type="button"
            aria-label="Nouvelle tâche"
            onClick={() => ui.openQuickAdd()}
            className="flex size-9 items-center justify-center rounded-lg bg-tomato-600 text-white focus-ring"
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <header className="gw-reveal">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] text-navy-500">
            {capitalize(formatLongDate(now))} · semaine {weekNumber(now)}
          </p>
          <OnlineNow className="hidden lg:flex" />
        </div>
        {/* The greeting, then what is on your plate — in one statement. */}
        <div className="mt-3 max-w-[46rem] text-[22px] leading-[1.32] tracking-[-0.02em] sm:text-[26px]">
          <h1 className="inline font-semibold text-navy-900">
            {hello}
            {me ? `, ${firstName(me.full_name)}` : ""}.
          </h1>{" "}
          <Summary />
        </div>
      </header>

      <KeyFigures className="mt-9" />

      <div className="mt-10 grid gap-x-14 gap-y-10 xl:grid-cols-12">
        <div className="min-w-0 space-y-10 xl:col-span-8">
          <WeekPriorities delay={120} />
          <ActivityFeed delay={240} limit={6} />
        </div>
        <div className="min-w-0 space-y-10 xl:col-span-4">
          <MeetingCard delay={160} />
          <ProjectCards delay={200} />
        </div>
      </div>
    </main>
  );
}
