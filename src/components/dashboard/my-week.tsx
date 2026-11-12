"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { TaskLine } from "@/components/tasks/task-line";
import { Button } from "@/components/ui/button";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMe, useNow, useWeekPriorities } from "@/lib/hooks";
import { ui } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import type { Task } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Figure } from "./figure";
import { Panel, PANEL_LINK } from "./panel";
import { useFitRows } from "./use-fit-rows";

/**
 * What is on my plate: how many tasks, what they are made of, the ones to take
 * first (as many as the tile has room for), and the way to add one.
 */
export function MyWeek({ className, delay }: { className?: string; delay?: number }) {
  const now = useNow();
  const me = useMe();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const today = todayDateOnly(now);

  const mine = useMemo(() => tasks.filter((t) => isOpen(t) && t.assignee_id === me?.id), [tasks, me?.id]);
  const priorities = mine.filter((t) => priorityIds.has(t.id)).length;
  const late = mine.filter((t) => isOverdue(t, today)).length;
  const blocked = mine.filter((t) => t.status === "blocked").length;
  const rest = [late > 0 && `${late} en retard`, blocked > 0 && plural(blocked, "bloquée")].filter(Boolean);
  const rows = useFitRows<HTMLDivElement>();
  // What to take first: the week's priorities, then what is late, what is under way, and the rest by date.
  const next = useMemo(() => {
    const rank = (t: Task) =>
      priorityIds.has(t.id) ? 0 : isOverdue(t, today) ? 1 : t.status === "in_progress" || t.status === "review" ? 2 : 3;
    const due = (t: Task) => t.due_date ?? "9999-12-31";
    return [...mine].sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b))).slice(0, 8);
  }, [mine, priorityIds, today]);

  return (
    <Panel
      className={cn("flex flex-col", className)}
      delay={delay}
      quiet
      title="Vos tâches ouvertes"
      aside={
        <Link href="/mes-taches" className={PANEL_LINK}>
          Mes tâches
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <p>
        <Figure value={mine.length} />
      </p>
      <p className="mt-3 text-xs leading-5 text-navy-600">
        {mine.length === 0 ? (
          "Rien ne vous attend pour l'instant."
        ) : (
          <>
            {priorities > 0 && (
              // Tomato marks the week's priorities, here and on their own tile.
              <span className="mr-1.5 rounded-[5px] bg-tomato-500/[0.13] px-[5px] py-[3px] font-medium text-tomato-800">
                {plural(priorities, "priorité")}
              </span>
            )}
            {priorities > 0 ? "de la semaine" : "Aucune priorité de la semaine"}
            {rest.length > 0 && <> · {rest.join(" · ")}</>}
          </>
        )}
      </p>
      {next.length > 0 ? (
        // The tile is as tall as its neighbour: the list takes the room that is left, in whole rows.
        <div ref={rows} className="gw-rows gw-fit mt-3 min-h-[156px] flex-1 basis-0">
          {next.map((t) => (
            <TaskLine
              key={t.id}
              task={t}
              show={{ lead: "status", status: false, project: false, assignee: false }}
              className="min-h-11 hover:bg-white/35"
            />
          ))}
        </div>
      ) : (
        // Nothing left to do: the ripe tomato keeps the tile company.
        <div className="flex flex-1 items-center justify-center py-5">
          <PixelTomato size={48} decorative />
        </div>
      )}
      {/* The page's one primary action, where my own tasks are. */}
      <Button size="lg" className="mt-4 self-start" onClick={() => ui.openQuickAdd()}>
        <Plus strokeWidth={2.5} />
        Nouvelle tâche
      </Button>
    </Panel>
  );
}
