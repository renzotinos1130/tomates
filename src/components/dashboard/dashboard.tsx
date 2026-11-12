"use client";

import { Plus } from "lucide-react";
import { useLayoutEffect } from "react";
import { GlassSettingsButton, useGlass } from "@/components/app/glass";
import { OnlineNow } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import { capitalize, formatLongDate, weekNumber } from "@/lib/dates";
import { useMe, useNow } from "@/lib/hooks";
import { ui } from "@/lib/store";
import { firstName } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { AtRisk } from "./at-risk";
import { MeetingTile } from "./meeting-tile";
import { MyWeek } from "./my-week";
import { ProjectCards } from "./project-cards";
import { TeamFaces } from "./team-faces";
import { WeekHero } from "./week-hero";
import { WeeklyDone } from "./weekly-done";

/**
 * The overview: a bento of glass tiles, each with a shape and a way of
 * speaking of its own, so that the page is read at a glance.
 *
 * - The tile the page is built around: the week's priorities, with their
 *   score and a tomato per priority (`WeekHero`).
 * - Three tiles that are one large figure each: my tasks, what needs
 *   unblocking, what was finished this week (`MyWeek`, `AtRisk`, `WeeklyDone`).
 * - The meeting beside the priorities it sets, and what moved lately in a
 *   tall tile at the side.
 * - The team's faces, and one tile per project with its ring.
 *
 * The areas are named in `.dash-grid` (globals.css): four columns on a wide
 * window, two, then one. Tiles of a row share its height and fill it with
 * their own content (see `.gw-fit`), never with a blank.
 *
 * The tiles sit straight on the scene, each one glass of its own: this screen
 * asks the shell for a bare window (no sheet behind the bento, never glass on
 * glass), and the greeting is a tile like the others.
 */
export function Dashboard() {
  const now = useNow();
  const me = useMe();
  const glass = useGlass();
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  // Before the first paint, and undone when the screen leaves (or is put aside by the router).
  useLayoutEffect(() => {
    ui.setBareWindow(true);
    return () => ui.setBareWindow(false);
  }, []);

  return (
    // No narrow cap: the bento keeps the same gap to the navigation as every window does.
    <main className="@container/dash mx-auto flex min-h-full w-full max-w-[2560px] flex-col px-1 pt-2.5 pb-2 lg:p-0">
      {/* Phones: the menu button lives in the shell (top left); this row holds what goes beside it. */}
      <div className="mb-4 flex h-9 items-center justify-end gap-2 lg:hidden">
        <OnlineNow />
        <Button size="icon-lg" aria-label="Nouvelle tâche" onClick={() => ui.openQuickAdd()}>
          <Plus strokeWidth={2.5} />
        </Button>
      </div>

      {/* As tall as the navigation beside it: on a tall screen the row of figures takes what is
          left, so the bento ends where the navigation does. */}
      <div className="dash-grid flex-1">
        <header className="gw-panel gw-reveal flex items-center justify-between gap-5 py-4 [grid-area:hello]">
          <div className="flex min-w-0 items-center gap-3.5 lg:gap-4">
            {/* Who is being greeted. The name is in the heading: the picture adds nothing to read. */}
            {me && (
              <MemberAvatar
                member={me}
                size="xl"
                className="shadow-[0_6px_16px_-8px_rgb(13_27_51/0.45)] ring-2 ring-white/80 lg:size-[68px]"
              />
            )}
            <div className="min-w-0">
              <p className="mb-[5px] text-[13px] text-navy-700">
                {capitalize(formatLongDate(now))} · semaine {weekNumber(now)}
              </p>
              <h1 className="text-[26px] leading-[1.15] font-medium tracking-[-0.035em] text-navy-900 lg:text-[clamp(27px,2.5vw,36px)]">
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
        <MyWeek className="[grid-area:mine]" delay={50} />
        <WeekHero className="[grid-area:week]" delay={100} />
        <MeetingTile className="[grid-area:meet]" delay={150} />
        <AtRisk className="[grid-area:risk]" delay={200} />
        <WeeklyDone className="[grid-area:done]" delay={250} />
        <TeamFaces className="[grid-area:team]" delay={300} />
        <ActivityFeed className="[grid-area:feed]" delay={350} />
        <ProjectCards className="[grid-area:proj]" delay={400} />
      </div>
    </main>
  );
}
