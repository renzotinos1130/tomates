"use client";

import { Plus } from "lucide-react";
import { useLayoutEffect } from "react";
import { OnlineNow } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { ui } from "@/lib/store";
import { ActivityFeed } from "./activity-feed";
import { Hero } from "./hero";
import { MeetingTicket } from "./meeting-ticket";
import { ProjectCards } from "./project-cards";
import { WeekLineup } from "./week-lineup";

/**
 * The overview. A page, not a wall of tiles: three bands that do not look
 * alike, read from top to bottom.
 *
 * 1. The greeting, in very large type set straight on the scene, with what is
 *    on my plate said in one sentence and the tasks to take first (`Hero`).
 * 2. The team's week as a line-up: the tomato of the week and a card per
 *    partner, their faces standing above the cards; three tabs change what
 *    the cards show (`WeekLineup`).
 * 3. Three things of different shapes: the meeting as a ticket, the projects
 *    as large percentages, and what moved lately.
 *
 * The glass sits straight on the scene: this screen asks the shell for a bare
 * window (no sheet behind it, never glass on glass). On a tall screen the
 * line-up takes the room that is left, so the page ends where the navigation
 * does.
 */
export function Dashboard() {
  // Before the first paint, and undone when the screen leaves (or is put aside by the router).
  useLayoutEffect(() => {
    ui.setBareWindow(true);
    return () => ui.setBareWindow(false);
  }, []);

  return (
    // No narrow cap: the page keeps the same gap to the navigation as every window does.
    <main className="@container/dash mx-auto flex min-h-full w-full max-w-[2560px] flex-col px-1 pt-2.5 pb-2 lg:p-0">
      {/* Phones: the menu button lives in the shell (top left); this row holds what goes beside it,
          above the mist that the greeting spreads behind itself. */}
      <div className="relative z-10 mb-4 flex h-9 items-center justify-end gap-2 lg:hidden">
        <OnlineNow />
        <Button size="icon-lg" aria-label="Nouvelle tâche" onClick={() => ui.openQuickAdd()}>
          <Plus strokeWidth={2.5} />
        </Button>
      </div>

      <div className="dash">
        <Hero />
        <WeekLineup delay={120} />
        <div className="dash-foot">
          <MeetingTicket className="[grid-area:meet]" delay={420} />
          <ProjectCards className="[grid-area:proj]" delay={460} />
          <ActivityFeed className="[grid-area:feed]" delay={560} />
        </div>
      </div>
    </main>
  );
}
