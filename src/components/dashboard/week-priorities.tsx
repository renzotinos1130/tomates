"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PixelTomato, RIPENESS_STAGES, ripenessStage } from "@/components/kit/pixel-tomato";
import { TaskLine } from "@/components/tasks/task-line";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWeekPriorities } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Section } from "./section";

/** Priorities chosen at the last Wednesday meeting, with who owns each. */
export function WeekPriorities({ className, delay }: { className?: string; delay?: number }) {
  const { ordered } = useWeekPriorities();
  const tasksMap = useApp((s) => s.tasks);
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
    <Section
      className={className}
      delay={delay}
      title="Priorités de la semaine"
      aside={tasks.length > 0 ? `${done} sur ${tasks.length}` : undefined}
      lead={
        tasks.length > 0 && (
          // The one playful touch of the page: the tomato ripens as priorities close.
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                <PixelTomato
                  size={16}
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
    >
      {sorted.length === 0 ? (
        <p className="py-2 text-[13px] text-navy-500">
          Aucune priorité pour l&apos;instant. Elles se choisissent pendant le{" "}
          <Link href="/meeting" className="font-medium text-navy-900 underline decoration-navy-900/25 underline-offset-2 hover:decoration-navy-900">
            meeting du mercredi
          </Link>
          .
        </p>
      ) : (
        <div className="-mx-2.5">
          {sorted.map((t) => (
            <TaskLine key={t.id} task={t} show={{ lead: "status", status: false }} />
          ))}
        </div>
      )}
    </Section>
  );
}
