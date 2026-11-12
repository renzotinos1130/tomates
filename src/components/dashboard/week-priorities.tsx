"use client";

import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Blocks } from "@/components/kit/blocks";
import { EmptyState } from "@/components/kit/empty-state";
import { PixelTomato, RIPENESS_STAGES, ripenessStage } from "@/components/kit/pixel-tomato";
import { TaskLine } from "@/components/tasks/task-line";
import { useTaskCounts } from "@/components/tasks/use-task-counts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/constants";
import { formatShortDate, parseDateOnly } from "@/lib/dates";
import { useWeekPriorities } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Tile, TileHeader } from "./bento";

/** Priorities chosen at the last Wednesday meeting, with who owns each. */
export function WeekPriorities({ className, delay }: { className?: string; delay?: number }) {
  const { meeting, ordered } = useWeekPriorities();
  const tasksMap = useApp((s) => s.tasks);
  const counts = useTaskCounts();
  const tasks = useMemo(
    () => ordered.map((id) => tasksMap[id]).filter((t): t is Task => !!t && !t.archived_at),
    [ordered, tasksMap],
  );
  const done = tasks.filter((t) => t.status === "done").length;
  const stage = ripenessStage(done, tasks.length);
  // Open first, finished at the bottom.
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done")),
    [tasks],
  );

  return (
    <Tile className={className} delay={delay}>
      <TileHeader
        title="Priorités de la semaine"
        lead={
          tasks.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="-mt-0.5 shrink-0">
                  <PixelTomato
                    size={32}
                    stage={stage}
                    title={`Tomate ${RIPENESS_STAGES[stage]} : ${done} sur ${plural(tasks.length, "priorité")} ${done >= 2 ? "terminées" : "terminée"}`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {stage === 3 ? "Tout est fait : la tomate est mûre." : "Elle mûrit à mesure que les priorités se terminent."}
              </TooltipContent>
            </Tooltip>
          )
        }
        hint={
          meeting
            ? `Choisies au meeting du ${formatShortDate(parseDateOnly(meeting.week_start))}`
            : "Choisies pendant le meeting du mercredi"
        }
        action={
          tasks.length > 0 && (
            <div className="flex items-center gap-2.5 pt-0.5">
              {/* One block per priority: the filled ones are done. */}
              <Blocks
                className="hidden sm:flex"
                wrap={false}
                max={16}
                groups={[
                  { count: done, color: STATUS_META.done.hex, label: "terminées" },
                  { count: tasks.length - done, color: "rgb(13 27 51 / 0.14)", label: "à faire" },
                ]}
                label={`${done} sur ${plural(tasks.length, "priorité")} ${done >= 2 ? "terminées" : "terminée"}`}
              />
              <span className="text-xs font-medium text-navy-700 tabular">
                {done}/{tasks.length}
              </span>
            </div>
          )
        }
      />
      <div className="px-2.5 pb-3">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Star className="size-4" />}
            title="Aucune priorité pour l'instant"
            hint="Pendant le meeting, marquez d'une étoile les tâches à accomplir avant mercredi prochain."
            action={
              <Link
                href="/meeting"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-600"
              >
                Ouvrir le meeting <ArrowRight className="size-3" />
              </Link>
            }
          />
        ) : (
          sorted.map((t) => <TaskLine key={t.id} task={t} counts={counts(t.id)} />)
        )}
      </div>
    </Tile>
  );
}
