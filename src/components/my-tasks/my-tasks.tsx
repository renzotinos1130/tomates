"use client";

import { addDays } from "date-fns";
import { CheckCheck, CircleDashed, Clock, PartyPopper, Plus, Star, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { CountBadge } from "@/components/kit/pills";
import { TaskLine } from "@/components/tasks/task-line";
import { useTaskCounts } from "@/components/tasks/use-task-counts";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMe, useMembers, useNow, useWeekPriorities } from "@/lib/hooks";
import { compareUrgency } from "@/lib/selectors";
import { ui } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import type { Task } from "@/lib/types";
import { cn, firstName, plural } from "@/lib/utils";

function Section({
  title,
  icon,
  tone,
  tasks,
  starred,
  hint,
  collapsible = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  tasks: Task[];
  starred: Set<string>;
  hint?: string;
  collapsible?: boolean;
  children?: React.ReactNode;
}) {
  const counts = useTaskCounts();
  const [open, setOpen] = useState(!collapsible);
  if (tasks.length === 0 && !children) return null;
  return (
    <section className="card-surface animate-fade-up">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-1.5">
        <span className={cn("flex size-6 items-center justify-center rounded-md", tone)}>{icon}</span>
        <h2 className="text-[14px] font-semibold text-navy-900">{title}</h2>
        <CountBadge>{tasks.length}</CountBadge>
        {hint && <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span>}
        {collapsible && tasks.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-navy-500 hover:bg-navy-900/[0.05] hover:text-navy-900 focus-ring"
          >
            {open ? "Masquer" : "Afficher"}
          </button>
        )}
      </header>
      <div className="px-1.5 pb-2">
        {open &&
          tasks.map((t) => (
            <TaskLine key={t.id} task={t} counts={counts(t.id)} starred={starred.has(t.id)} show={{ assignee: false, priority: true }} />
          ))}
        {children}
      </div>
    </section>
  );
}

/** A member's personal view — built to be scanned in a minute every morning. */
export function MyTasks() {
  const now = useNow();
  const me = useMe();
  const members = useMembers();
  const router = useRouter();
  const params = useSearchParams();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const today = todayDateOnly(now);

  const viewed = members.find((m) => m.id === params.get("membre")) ?? me;
  const isMe = viewed?.id === me?.id;

  const groups = useMemo(() => {
    const mine = tasks.filter((t) => t.assignee_id === viewed?.id && !t.archived_at);
    const open = mine.filter(isOpen).sort(compareUrgency);
    const taken = new Set<string>();
    const take = (list: Task[]) => {
      const out = list.filter((t) => !taken.has(t.id));
      out.forEach((t) => taken.add(t.id));
      return out;
    };
    const priorities = take(open.filter((t) => priorityIds.has(t.id)));
    const overdue = take(open.filter((t) => isOverdue(t, today)));
    const doing = take(open.filter((t) => t.status !== "todo"));
    const upcoming = take(open);
    const since = addDays(now, -7).toISOString();
    const done = mine
      .filter((t) => t.status === "done" && t.completed_at && t.completed_at >= since)
      .sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? 1 : -1));
    return { open, priorities, overdue, doing, upcoming, done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, viewed?.id, priorityIds, today]);

  if (!viewed) return null;
  const lateCount = groups.open.filter((t) => isOverdue(t, today)).length;
  const nothing = groups.open.length === 0;

  return (
    <>
      <PageHeader
        title={isMe ? "Mes tâches" : `Tâches de ${firstName(viewed.full_name)}`}
        subtitle={
          <>
            {plural(groups.open.length, "tâche ouverte", "tâches ouvertes")}
            {lateCount > 0 && <span className="text-coral-600"> · {lateCount} en retard</span>}
          </>
        }
        actions={
          <Button onClick={() => ui.openQuickAdd({ assignee_id: viewed.id })} className="shadow-button">
            <Plus /> <span className="hidden sm:inline">Nouvelle tâche</span>
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-[920px] space-y-3 px-4 pt-5 pb-24 sm:space-y-4 sm:px-6 lg:px-8">
        {/* Whose tasks */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Choisir un membre">
          {(me ? [me, ...members.filter((m) => m.id !== me.id)] : members).map((m) => {
            const on = m.id === viewed.id;
            return (
              <Tooltip key={m.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => router.replace(m.id === me?.id ? "/mes-taches" : `/mes-taches?membre=${m.id}`)}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[13px] transition-all duration-200 focus-ring",
                      on ? "bg-card font-medium text-navy-900 shadow-card" : "text-navy-500 hover:bg-navy-900/[0.05] hover:text-navy-800",
                    )}
                  >
                    <MemberAvatar member={m} size="md" />
                    {m.id === me?.id ? "Moi" : firstName(m.full_name)}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{m.full_name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {nothing && (
          <div className="card-surface">
            <EmptyState
              className="py-14"
              icon={<PartyPopper className="size-4" />}
              title={isMe ? "Rien à faire pour l'instant" : `${firstName(viewed.full_name)} n'a aucune tâche ouverte`}
              hint="Les tâches assignées pendant le meeting du mercredi apparaîtront ici."
              action={
                <Button variant="outline" onClick={() => ui.openQuickAdd({ assignee_id: viewed.id })}>
                  <Plus /> Ajouter une tâche
                </Button>
              }
            />
          </div>
        )}

        <Section
          title={isMe ? "Mes priorités de la semaine" : "Priorités de la semaine"}
          icon={<Star className="size-3.5 fill-sun-400" />}
          tone="bg-sun-50 text-sun-500"
          tasks={groups.priorities}
          starred={new Set()}
          hint="À boucler avant mercredi prochain"
        />
        <Section
          title="En retard"
          icon={<Clock className="size-3.5" />}
          tone="bg-coral-50 text-coral-600"
          tasks={groups.overdue}
          starred={priorityIds}
        />
        <Section
          title="En cours"
          icon={<Zap className="size-3.5" />}
          tone="bg-teal-50 text-teal-600"
          tasks={groups.doing}
          starred={priorityIds}
        />
        <Section
          title="À venir"
          icon={<CircleDashed className="size-3.5" />}
          tone="bg-navy-100 text-navy-600"
          tasks={groups.upcoming}
          starred={priorityIds}
        />
        <Section
          title="Complétées récemment"
          icon={<CheckCheck className="size-3.5" />}
          tone="bg-leaf-50 text-leaf-600"
          tasks={groups.done}
          starred={new Set()}
          hint="7 derniers jours"
          collapsible={groups.open.length > 0}
        />
      </main>
    </>
  );
}
