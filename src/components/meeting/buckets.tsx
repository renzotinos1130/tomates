"use client";

import { CheckCheck, Clock, Hourglass, OctagonAlert, ScanEye } from "lucide-react";
import { useMemo, useState } from "react";
import { CountBadge } from "@/components/kit/pills";
import { TaskLine } from "@/components/tasks/task-line";
import { useTaskCounts } from "@/components/tasks/use-task-counts";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useEditablePriorityIds, useMeetings, useNow } from "@/lib/hooks";
import { meetingBuckets, meetingSince, type MeetingBuckets } from "@/lib/selectors";
import type { ID, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The five automatic lists of the weekly review, for a given meeting week. */
export function useMeetingBuckets(weekStart: string, projectId: ID | null = null): MeetingBuckets & { since: string } {
  const now = useNow();
  const tasks = useAllTasks();
  const meetings = useMeetings();
  const today = todayDateOnly(now);
  return useMemo(() => {
    const since = meetingSince(meetings, weekStart);
    const scoped = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;
    return { ...meetingBuckets(scoped, since, today), since };
  }, [tasks, meetings, weekStart, projectId, today]);
}

const LIMIT = 5;

function Bucket({
  title,
  hint,
  icon,
  tone,
  tasks,
  empty,
  className,
  showProject,
  lead = "none",
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  tasks: Task[];
  empty: string;
  className?: string;
  showProject: boolean;
  lead?: "status" | "none";
}) {
  const counts = useTaskCounts();
  const starred = useEditablePriorityIds();
  const [all, setAll] = useState(false);
  const shown = all ? tasks : tasks.slice(0, LIMIT);
  return (
    <section className={cn("card-surface flex flex-col", className)}>
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone)}>{icon}</span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-navy-900">
            <span className="truncate">{title}</span>
            <CountBadge>{tasks.length}</CountBadge>
          </h3>
        </div>
      </header>
      <p className="px-4 pb-1.5 text-xs text-muted-foreground">{hint}</p>
      <div className="px-1.5 pb-2">
        {tasks.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-navy-400">{empty}</p>
        ) : (
          <>
            {shown.map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                counts={counts(t.id)}
                starred={starred.has(t.id)}
                show={{ lead: lead, strike: false, status: false, project: showProject }}
              />
            ))}
            {tasks.length > LIMIT && (
              <button
                type="button"
                onClick={() => setAll(!all)}
                className="mt-0.5 ml-2.5 rounded-md px-1.5 py-1 text-xs font-medium text-teal-700 hover:text-teal-600 focus-ring"
              >
                {all ? "Réduire" : tasks.length - LIMIT === 1 ? "Voir 1 autre" : `Voir les ${tasks.length - LIMIT} autres`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** "Avant le meeting": what happened since last Wednesday, computed automatically. */
export function Buckets({ buckets, showProject = true }: { buckets: MeetingBuckets; showProject?: boolean }) {
  return (
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
      <Bucket
        className="lg:col-span-2"
        title="Complétées depuis mercredi dernier"
        hint="Ce que l'équipe a accompli depuis la dernière rencontre."
        icon={<CheckCheck className="size-3.5" />}
        tone="bg-leaf-50 text-leaf-600"
        tasks={buckets.completed}
        empty="Rien de terminé depuis le dernier meeting."
        showProject={showProject}
        lead="status"
      />
      <Bucket
        title="À valider ensemble"
        hint="En validation : une décision de l'équipe est attendue."
        icon={<ScanEye className="size-3.5" />}
        tone="bg-sun-50 text-sun-600"
        tasks={buckets.review}
        empty="Rien à valider."
        showProject={showProject}
      />
      <Bucket
        title="Bloquées"
        hint="Quelqu'un a besoin d'aide pour avancer."
        icon={<OctagonAlert className="size-3.5" />}
        tone="bg-coral-50 text-coral-600"
        tasks={buckets.blocked}
        empty="Aucun blocage."
        showProject={showProject}
      />
      <Bucket
        title="En retard"
        hint="L'échéance est dépassée."
        icon={<Clock className="size-3.5" />}
        tone="bg-coral-50 text-coral-600"
        tasks={buckets.overdue}
        empty="Aucun retard."
        showProject={showProject}
      />
      <Bucket
        title="Sans progrès"
        hint="Aucun changement de statut depuis le dernier meeting."
        icon={<Hourglass className="size-3.5" />}
        tone="bg-navy-100 text-navy-600"
        tasks={buckets.stalled}
        empty="Tout a bougé cette semaine."
        showProject={showProject}
      />
    </div>
  );
}
