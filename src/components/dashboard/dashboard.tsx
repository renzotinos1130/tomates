"use client";

import { Plus } from "lucide-react";
import { GlassSettingsButton, useGlass } from "@/components/app/glass";
import { OnlineNow } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
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
 * The overview: a bento of glass tiles laid on the window. What is on my plate
 * and the next meeting, the team's week; the priorities and what moved; then
 * one tile per project. Tiles of a row share its height and every row is
 * full: a tile fills its room with its own content (see `.gw-fit`), never
 * with a blank. The columns follow the width of the window, not of the screen.
 */
export function Dashboard() {
  const now = useNow();
  const me = useMe();
  const glass = useGlass();
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <main className="@container/dash mx-auto w-full max-w-[1320px] px-[15px] pt-2.5 pb-8 sm:px-6 lg:px-[30px] lg:pt-[30px] lg:pb-10">
      {/* Phones: the menu button lives in the shell (top left); this row holds what goes beside it. */}
      <div className="mb-4 flex h-9 items-center justify-end gap-2 lg:hidden">
        <OnlineNow />
        <Button size="icon-lg" aria-label="Nouvelle tâche" onClick={() => ui.openQuickAdd()}>
          <Plus strokeWidth={2.5} />
        </Button>
      </div>

      <header className="gw-reveal mb-5 flex items-center justify-between gap-5 lg:mb-7">
        <div className="flex min-w-0 items-center gap-3.5 lg:gap-4">
          {/* Who is being greeted. The name is in the heading: the picture adds nothing to read. */}
          {me && (
            <MemberAvatar
              member={me}
              size="xl"
              className="shadow-[0_6px_16px_-8px_rgb(13_27_51/0.45)] ring-2 ring-white/80 lg:size-16"
            />
          )}
          <div className="min-w-0">
            <p className="mb-[5px] text-[13px] text-navy-700">
              {capitalize(formatLongDate(now))} · semaine {weekNumber(now)}
            </p>
            <h1 className="text-[25px] leading-[1.18] font-medium tracking-[-0.035em] text-navy-900 lg:text-[clamp(25px,2.3vw,31px)]">
              {hello}
              {me ? `, ${firstName(me.full_name)}` : ""}.
            </h1>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <OnlineNow />
          <GlassSettingsButton labelled settings={glass.settings} update={glass.update} reset={glass.reset} />
        </div>
      </header>

      <div className="grid gap-3 @3xl/dash:gap-4">
        <div className="grid gap-3 @3xl/dash:grid-cols-[0.82fr_1.5fr] @3xl/dash:gap-4">
          <MyWeek delay={45} />
          <TeamPulse delay={90} />
        </div>
        {/* The priorities give the row its height; the activity shows what fits beside them. */}
        <div className="grid gap-3 @3xl/dash:grid-cols-[1.3fr_1fr] @3xl/dash:gap-4">
          <WeekPriorities delay={135} />
          <ActivityFeed delay={180} />
        </div>
        <ProjectCards delay={225} />
      </div>
    </main>
  );
}
