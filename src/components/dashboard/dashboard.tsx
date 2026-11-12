"use client";

import { Menu, Plus } from "lucide-react";
import { GlassSettingsButton, useGlass } from "@/components/app/glass";
import { OnlineNow } from "@/components/app/page-header";
import { capitalize, formatLongDate, weekNumber } from "@/lib/dates";
import { useMe, useNow } from "@/lib/hooks";
import { ui } from "@/lib/store";
import { firstName } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { MyWeek } from "./my-week";
import { ProjectCards } from "./project-cards";
import { TeamPulse } from "./team-pulse";
import { WeekPriorities } from "./week-priorities";

/**
 * The overview: tiles of glass laid on the window. What is on my plate and the
 * next meeting, the team's week, the priorities, the projects, what moved.
 * The two-column grids follow the width of the window, not of the screen.
 */
export function Dashboard() {
  const now = useNow();
  const me = useMe();
  const glass = useGlass();
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <main className="@container/dash mx-auto w-full max-w-[1320px] px-[15px] pt-4 pb-8 sm:px-6 lg:px-[30px] lg:pt-[30px] lg:pb-10">
      {/* Mobile top row */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => ui.setMobileNav(true)}
          className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-navy-800 hover:bg-white/30 focus-ring"
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

      <header className="gw-reveal mb-5 flex items-center justify-between gap-5 lg:mb-7">
        <div className="min-w-0">
          <p className="mb-[5px] text-[13px] text-navy-700">
            {capitalize(formatLongDate(now))} · semaine {weekNumber(now)}
          </p>
          <h1 className="text-[25px] leading-[1.18] font-medium tracking-[-0.035em] text-navy-900 lg:text-[clamp(25px,2.3vw,31px)]">
            {hello}
            {me ? `, ${firstName(me.full_name)}` : ""}.
          </h1>
        </div>
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <OnlineNow />
          <GlassSettingsButton labelled settings={glass.settings} update={glass.update} reset={glass.reset} />
        </div>
      </header>

      <div className="mb-3 grid gap-3 @3xl/dash:mb-4 @3xl/dash:grid-cols-[0.82fr_1.5fr] @3xl/dash:gap-4">
        <MyWeek delay={45} />
        <TeamPulse delay={90} />
      </div>
      <div className="grid items-start gap-3 @3xl/dash:grid-cols-[1.3fr_1fr] @3xl/dash:gap-4">
        <WeekPriorities delay={135} />
        <div className="grid min-w-0 gap-3 @3xl/dash:gap-4">
          <ProjectCards delay={180} />
          <ActivityFeed delay={225} limit={5} />
        </div>
      </div>
    </main>
  );
}
