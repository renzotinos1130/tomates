"use client";

import { ArrowRight, Plus } from "@/components/kit/icons";
import Link from "next/link";
import { useMemo } from "react";
import { OnlineNow } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { TaskLine } from "@/components/tasks/task-line";
import { Button } from "@/components/ui/button";
import { capitalize, formatLongDate, todayDateOnly, weekNumber } from "@/lib/dates";
import { useAllTasks, useMe, useNow, useWeekPriorities } from "@/lib/hooks";
import { ui } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import type { Task } from "@/lib/types";
import { firstName } from "@/lib/utils";

/**
 * The top of the page: who is greeted, in very large type set straight on the
 * scene (no tile: the page opens on a sentence, not on a box), what is on
 * their plate said in one line, and the three tasks to take first.
 */
export function Hero() {
  const now = useNow();
  const me = useMe();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const today = todayDateOnly(now);
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 18 ? "Bonjour" : "Bonsoir";

  const mine = useMemo(() => tasks.filter((t) => isOpen(t) && t.assignee_id === me?.id), [tasks, me?.id]);
  const priorities = mine.filter((t) => priorityIds.has(t.id)).length;
  const late = mine.filter((t) => isOverdue(t, today)).length;
  const blocked = mine.filter((t) => t.status === "blocked").length;
  // What to take first: the week's priorities, then what is late, what is under way, and the rest by date.
  const next = useMemo(() => {
    const rank = (t: Task) =>
      priorityIds.has(t.id) ? 0 : isOverdue(t, today) ? 1 : t.status === "in_progress" || t.status === "review" ? 2 : 3;
    const due = (t: Task) => t.due_date ?? "9999-12-31";
    return [...mine].sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b))).slice(0, 3);
  }, [mine, priorityIds, today]);

  return (
    <header className="dash-hero">
      <div className="dash-hero-id">
        {/* Who is being greeted. The name is in the heading: the picture adds nothing to read. */}
        {me && (
          <MemberAvatar
            member={me}
            size="2xl"
            className="dash-hero-in size-[clamp(84px,9.4cqw,168px)] shadow-[0_22px_44px_-22px_rgb(var(--shade-rgb)/0.55)] ring-4 ring-glaze/85"
          />
        )}
        <div className="min-w-0">
          <p className="dash-hero-in mb-2 text-[13px] font-medium text-navy-900 lg:mb-3">
            {capitalize(formatLongDate(now))} · semaine {weekNumber(now)}
          </p>
          <h1 className="dash-hello">
            <span>
              <span>{hello}{me ? "," : "."}</span>
            </span>{" "}
            {me && (
              <span>
                <span>{firstName(me.full_name)}.</span>
              </span>
            )}
          </h1>
          <p className="dash-hero-in mt-4 text-[15px] leading-6 text-navy-900 lg:mt-5 lg:text-base">
            {mine.length === 0 ? (
              "Rien ne vous attend pour l'instant."
            ) : (
              <>
                <b className="font-semibold tabular">{mine.length}</b> {mine.length >= 2 ? "tâches ouvertes" : "tâche ouverte"}
                {priorities > 0 && (
                  <>
                    , dont <b className="font-semibold tabular">{priorities}</b>{" "}
                    {priorities >= 2 ? "priorités de la semaine" : "priorité de la semaine"}
                  </>
                )}
                {blocked > 0 && (
                  <>
                    {" "}
                    · <b className="font-semibold tabular">{blocked}</b> {blocked >= 2 ? "bloquées" : "bloquée"}
                  </>
                )}
                {late > 0 && (
                  <>
                    {" "}
                    · <b className="font-semibold tabular">{late}</b> en retard
                  </>
                )}
              </>
            )}
          </p>
          {/* The page's one primary action, and the way to the rest of my tasks. */}
          <div className="dash-hero-in mt-5 flex flex-wrap items-center gap-2.5">
            <Button size="lg" onClick={() => ui.openQuickAdd()}>
              <Plus strokeWidth={2.5} />
              Nouvelle tâche
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-glaze/60">
              <Link href="/mes-taches">
                Mes tâches
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="dash-hero-in flex min-w-0 flex-col gap-3">
        {/* Who else is here. Nothing when nobody is: the card then starts the column. */}
        <div className="hidden items-center justify-end gap-3 empty:hidden lg:flex">
          <OnlineNow />
        </div>
        <section className="gw-panel @container/panel" aria-labelledby="dash-next">
          <header className="gw-panel-title">
            <h2 id="dash-next" className="gw-panel-label truncate">
              À prendre en premier
            </h2>
          </header>
          {next.length > 0 ? (
            <div className="gw-rows -my-1.5">
              {next.map((t) => (
                <TaskLine
                  key={t.id}
                  task={t}
                  show={{ lead: "status", status: false, project: false, assignee: false }}
                  className="min-h-11 hover:bg-glaze/35"
                />
              ))}
            </div>
          ) : (
            // Nothing left to do: the ripe tomato keeps the card company.
            <div className="flex items-center gap-3 py-2">
              <PixelTomato size={32} decorative />
              <p className="text-[13px] text-navy-600">Tout est fait. Belle récolte.</p>
            </div>
          )}
        </section>
      </div>
    </header>
  );
}
