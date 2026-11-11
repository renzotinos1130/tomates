"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, CornerDownLeft, Flag, Plus, RotateCw, Star, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StatusBar } from "@/components/dashboard/project-cards";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { DuePicker, PriorityPicker } from "@/components/kit/pickers";
import { CountBadge, DueLabel, Kbd, PriorityStar } from "@/components/kit/pills";
import { PriorityIcon } from "@/components/kit/priority-icon";
import { ProjectIcon } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { chipClass } from "@/components/tasks/draft-controls";
import { TaskLine } from "@/components/tasks/task-line";
import { useTaskCounts } from "@/components/tasks/use-task-counts";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIORITY_META, STATUS_META, STATUSES } from "@/lib/constants";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMeetings, useMembers, useNow, useProjects, useProjectsMap, useSecondTick } from "@/lib/hooks";
import { buildMeetingSummary, compareUrgency, previousMeeting, prioritiesFor, projectStats } from "@/lib/selectors";
import { closeMeeting, createTask, setWeekPriority, ui, useApp } from "@/lib/store";
import { isOpen } from "@/lib/task-logic";
import type { DateOnly, ID, Meeting, Member, Project, Task, TaskPriority, TaskStatus } from "@/lib/types";
import { cn, firstName, nowIso, plural } from "@/lib/utils";
import { Agenda } from "./agenda";
import { Buckets, useMeetingBuckets } from "./buckets";
import { Recap } from "./recap";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function usePriorityIds(meetingId: ID): Set<ID> {
  const priorities = useApp((s) => s.meeting_priorities);
  return useMemo(
    () => new Set(prioritiesFor(meetingId, Object.values(priorities)).map((p) => p.task_id)),
    [priorities, meetingId],
  );
}

function StarToggle({ taskId, meetingId, on }: { taskId: ID; meetingId: ID; on: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={on}
          aria-label={on ? "Retirer des priorités de la semaine" : "Ajouter aux priorités de la semaine"}
          onClick={(e) => {
            e.stopPropagation();
            void setWeekPriority(taskId, !on, meetingId);
          }}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 focus-ring",
            on ? "bg-sun-50 hover:bg-sun-100" : "hover:bg-navy-900/[0.06] [&:hover_svg]:text-sun-600",
          )}
        >
          <PriorityStar active={on} className={cn(on && "animate-pop")} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{on ? "Priorité de la semaine" : "Marquer comme priorité de la semaine"}</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Quick add — create & assign without leaving the meeting             */
/* ------------------------------------------------------------------ */

function MeetingQuickAdd({ project, meeting }: { project: Project; meeting: Meeting }) {
  const members = useMembers();
  const now = useNow();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<ID | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [due, setDue] = useState<DateOnly | null>(null);
  const [star, setStar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const clean = title.trim();
    if (!clean) return;
    setTitle("");
    setDue(null);
    setPriority("normal");
    setStar(false);
    inputRef.current?.focus();
    const task = await createTask({
      project_id: project.id,
      title: clean,
      assignee_id: assignee,
      priority,
      due_date: due,
      weekPriority: star,
      meeting_id: meeting.id,
      placement: "top",
    });
    if (task) {
      const who = members.find((m) => m.id === assignee);
      toast.success("Tâche ajoutée", {
        description: who ? `${task.title} — ${firstName(who.full_name)}` : task.title,
      });
    }
  };

  return (
    <div className="card-surface p-3 transition-shadow focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-teal-500/25">
      <div className="flex items-center gap-2.5 px-1">
        <Plus className="size-[18px] shrink-0 text-teal-600" />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder={`Nouvelle tâche — ${project.name}`}
          aria-label={`Nouvelle tâche pour ${project.name}`}
          maxLength={500}
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-navy-900 outline-none placeholder:font-normal placeholder:text-navy-400"
        />
        <Button size="sm" disabled={!title.trim()} onClick={() => void submit()} className="shrink-0">
          Ajouter
          <Kbd className="border-white/20 bg-white/10 text-white">
            <CornerDownLeft className="size-3" />
          </Kbd>
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-navy-900/[0.06] px-1 pt-2.5">
        <div className="flex items-center gap-1" role="group" aria-label="Responsable">
          <span className="mr-1 text-xs text-muted-foreground">Pour</span>
          {members.map((m) => (
            <Tooltip key={m.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={assignee === m.id}
                  aria-label={`Assigner à ${m.full_name}`}
                  onClick={() => setAssignee(assignee === m.id ? null : m.id)}
                  className={cn(
                    "rounded-full transition-all duration-150 focus-ring",
                    assignee === m.id
                      ? "scale-110 ring-2 ring-teal-500 ring-offset-2 ring-offset-card"
                      : assignee
                        ? "opacity-55 hover:opacity-100"
                        : "hover:scale-105",
                  )}
                >
                  <MemberAvatar member={m} size="md" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{m.full_name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <span className="hidden h-5 w-px bg-navy-900/10 sm:block" />
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityPicker value={priority} onChange={setPriority}>
            <button type="button" className={chipClass}>
              <PriorityIcon priority={priority} size={14} />
              {PRIORITY_META[priority].label}
            </button>
          </PriorityPicker>
          <DuePicker value={due} onChange={setDue}>
            <button type="button" className={chipClass}>
              {due ? (
                <DueLabel date={due} now={now} className="font-medium" />
              ) : (
                <>
                  <CalendarDays className="size-3.5 text-navy-400" />
                  Échéance
                </>
              )}
            </button>
          </DuePicker>
          <button
            type="button"
            aria-pressed={star}
            onClick={() => setStar(!star)}
            className={cn(chipClass, star && "border-sun-300 bg-sun-50 text-sun-800 hover:bg-sun-100")}
          >
            <PriorityStar active={star} className="size-3.5" />
            Priorité de la semaine
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

const REVIEW_ORDER: TaskStatus[] = ["blocked", "review", "in_progress", "todo"];

function ProjectStep({ project, meeting }: { project: Project; meeting: Meeting }) {
  const now = useNow();
  const all = useAllTasks();
  const counts = useTaskCounts();
  const starred = usePriorityIds(meeting.id);
  const buckets = useMeetingBuckets(meeting.week_start, project.id);
  const [showDone, setShowDone] = useState(false);

  const tasks = useMemo(() => all.filter((t) => t.project_id === project.id), [all, project.id]);
  const stats = useMemo(() => projectStats(tasks, project.id, todayDateOnly(now)), [tasks, project.id, now]);
  const groups = useMemo(
    () =>
      REVIEW_ORDER.map((status) => ({
        status,
        tasks: tasks
          .filter((t) => isOpen(t) && t.status === status)
          .sort((a, b) => Number(b.meeting_id === meeting.id) - Number(a.meeting_id === meeting.id) || compareUrgency(a, b)),
      })).filter((g) => g.tasks.length > 0),
    [tasks, meeting.id],
  );
  const barTotal = STATUSES.reduce((n, s) => n + stats.byStatus[s], 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="card-surface flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
        <ProjectIcon project={project} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold text-navy-900">{project.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {plural(stats.open, "tâche ouverte", "tâches ouvertes")}
            {stats.byStatus.blocked > 0 && <span className="text-coral-600"> · {plural(stats.byStatus.blocked, "bloquée")}</span>}
            {stats.overdue > 0 && <span className="text-coral-600"> · {stats.overdue} en retard</span>}
            {buckets.completed.length > 0 && (
              <span className="text-leaf-600"> · {plural(buckets.completed.length, "terminée")} depuis mercredi</span>
            )}
          </p>
        </div>
        <div className="w-full sm:w-52">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Avancement</span>
            <span className="text-sm font-semibold text-navy-900 tabular">{stats.progress}%</span>
          </div>
          <StatusBar byStatus={stats.byStatus} total={barTotal} />
        </div>
      </div>

      <MeetingQuickAdd project={project} meeting={meeting} />

      {groups.length === 0 && (
        <div className="card-surface px-5 py-8 text-center text-[13px] text-muted-foreground">
          Aucune tâche ouverte dans ce projet. Ajoutez la première ci-dessus.
        </div>
      )}

      {groups.map((g) => (
        <section key={g.status} className="card-surface relative overflow-hidden">
          <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", STATUS_META[g.status].accent)} />
          <header className="flex items-center gap-2 px-4 pt-3 pb-1">
            <StatusIcon status={g.status} />
            <h3 className="text-[13px] font-semibold text-navy-900">{STATUS_META[g.status].label}</h3>
            <CountBadge>{g.tasks.length}</CountBadge>
          </header>
          <div className="px-1.5 pb-2">
            {g.tasks.map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                counts={counts(t.id)}
                show={{ project: false, priority: true }}
                badge={
                  t.meeting_id === meeting.id ? (
                    <span className="shrink-0 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10.5px] font-medium text-teal-700">
                      Nouveau
                    </span>
                  ) : null
                }
                trailing={<StarToggle taskId={t.id} meetingId={meeting.id} on={starred.has(t.id)} />}
              />
            ))}
          </div>
        </section>
      ))}

      {buckets.completed.length > 0 && (
        <section className="card-surface">
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
            className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left focus-ring"
          >
            <ChevronRight className={cn("size-3.5 text-navy-400 transition-transform", showDone && "rotate-90")} />
            <StatusIcon status="done" />
            <span className="text-[13px] font-semibold text-navy-900">Terminées depuis le dernier meeting</span>
            <CountBadge>{buckets.completed.length}</CountBadge>
          </button>
          {showDone && (
            <div className="px-1.5 pb-2">
              {buckets.completed.map((t) => (
                <TaskLine key={t.id} task={t} counts={counts(t.id)} show={{ project: false, status: false, lead: "status", strike: false }} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function AddPriority({ member, meetingId, exclude }: { member: Member | null; meetingId: ID; exclude: Set<ID> }) {
  const [open, setOpen] = useState(false);
  const tasks = useAllTasks();
  const projects = useProjectsMap();
  const candidates = useMemo(
    () => tasks.filter((t) => isOpen(t) && !exclude.has(t.id)).sort(compareUrgency),
    [tasks, exclude],
  );
  const own = candidates.filter((t) => (member ? t.assignee_id === member.id : !t.assignee_id));
  const others = member ? candidates.filter((t) => t.assignee_id !== member.id) : [];
  const item = (t: Task) => (
    <CommandItem
      key={t.id}
      value={`${t.title} ${t.id}`}
      onSelect={() => {
        void setWeekPriority(t.id, true, meetingId);
        setOpen(false);
      }}
    >
      <StatusIcon status={t.status} />
      <span className="truncate">{t.title}</span>
      <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">{projects[t.project_id]?.name}</span>
    </CommandItem>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-navy-400 transition-colors hover:bg-navy-900/[0.05] hover:text-navy-700 focus-ring"
        >
          <Plus className="size-4" /> Ajouter une priorité
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher une tâche…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Aucune tâche ouverte.</CommandEmpty>
            {own.length > 0 && (
              <CommandGroup heading={member ? `Tâches de ${firstName(member.full_name)}` : "Sans responsable"}>
                {own.map(item)}
              </CommandGroup>
            )}
            {others.length > 0 && <CommandGroup heading="Autres tâches">{others.slice(0, 40).map(item)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PrioritiesStep({ meeting }: { meeting: Meeting }) {
  const now = useNow();
  const members = useMembers();
  const meetings = useMeetings();
  const tasksMap = useApp((s) => s.tasks);
  const priorities = useApp((s) => s.meeting_priorities);
  const starred = usePriorityIds(meeting.id);

  const mine = useMemo(
    () =>
      prioritiesFor(meeting.id, Object.values(priorities))
        .map((p) => tasksMap[p.task_id])
        .filter((t): t is Task => !!t && !t.archived_at),
    [priorities, meeting.id, tasksMap],
  );
  // Last week's priorities that are still open and not renewed yet.
  const carry = useMemo(() => {
    const prev = previousMeeting(meetings, meeting);
    if (!prev) return [];
    return prioritiesFor(prev.id, Object.values(priorities))
      .map((p) => tasksMap[p.task_id])
      .filter((t): t is Task => !!t && isOpen(t) && !starred.has(t.id));
  }, [meetings, meeting, priorities, tasksMap, starred]);

  const columns: { member: Member | null; tasks: Task[] }[] = members.map((m) => ({
    member: m,
    tasks: mine.filter((t) => t.assignee_id === m.id),
  }));
  const orphan = mine.filter((t) => !t.assignee_id || !members.some((m) => m.id === t.assignee_id));
  if (orphan.length) columns.push({ member: null, tasks: orphan });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="card-surface flex flex-wrap items-center gap-4 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-sun-500 ring-1 ring-sun-100 ring-inset">
          <Star className="size-5 fill-sun-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold text-navy-900">Priorités de la semaine</h2>
          <p className="text-xs text-muted-foreground">
            Ce que chacun s&apos;engage à accomplir avant mercredi prochain. {plural(mine.length, "priorité")} pour l&apos;instant.
          </p>
        </div>
      </div>

      {carry.length > 0 && (
        <section className="card-surface">
          <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-1">
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-100 text-navy-600">
              <RotateCw className="size-3.5" />
            </span>
            <h3 className="text-[13.5px] font-semibold text-navy-900">Non terminées la semaine dernière</h3>
            <CountBadge>{carry.length}</CountBadge>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => carry.forEach((t) => void setWeekPriority(t.id, true, meeting.id))}
            >
              Tout reconduire
            </Button>
          </header>
          <p className="px-4 pb-1.5 text-xs text-muted-foreground">
            Ces priorités restent ouvertes. Reconduisez celles qui comptent encore cette semaine.
          </p>
          <div className="px-1.5 pb-2">
            {carry.map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                show={{ lead: "status" }}
                trailing={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-teal-700 hover:text-teal-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      void setWeekPriority(t.id, true, meeting.id);
                    }}
                  >
                    Reconduire
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {columns.map(({ member, tasks }) => (
          <section key={member?.id ?? "none"} className="card-surface flex flex-col p-3">
            <header className="flex items-center gap-2.5 px-1 pb-2">
              <MemberAvatar member={member} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[14px] font-semibold text-navy-900">{member?.full_name ?? "Sans responsable"}</h3>
                <p className="text-xs text-muted-foreground">{plural(tasks.length, "priorité")}</p>
              </div>
            </header>
            <ul className="space-y-0.5">
              {tasks.map((t) => (
                <li key={t.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-900/[0.03]">
                  <StatusIcon status={t.status} />
                  <button
                    type="button"
                    onClick={() => ui.openTask(t.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded text-left text-[13px] focus-ring",
                      t.status === "done" ? "text-navy-400 line-through decoration-navy-200" : "font-medium text-navy-900",
                    )}
                  >
                    {t.title}
                  </button>
                  {t.due_date && <DueLabel date={t.due_date} done={t.status === "done"} now={now} icon={false} className="shrink-0" />}
                  <button
                    type="button"
                    aria-label="Retirer des priorités"
                    onClick={() => void setWeekPriority(t.id, false, meeting.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-navy-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-coral-50 hover:text-coral-600 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-1">
              <AddPriority member={member} meetingId={meeting.id} exclude={starred} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CloseStep({ meeting }: { meeting: Meeting }) {
  const s = useApp();
  const now = useNow();
  const summary = useMemo(
    () =>
      buildMeetingSummary(
        {
          tasks: Object.values(s.tasks),
          members: Object.values(s.members),
          projects: Object.values(s.projects),
          items: Object.values(s.meeting_items),
          priorities: Object.values(s.meeting_priorities),
          meetings: Object.values(s.meetings),
        },
        meeting,
        nowIso(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.tasks, s.meeting_items, s.meeting_priorities, s.meetings, s.members, s.projects, meeting, now],
  );
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="card-surface flex flex-wrap items-center gap-4 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100 ring-inset">
          <Flag className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold text-navy-900">Prêts à conclure ?</h2>
          <p className="text-xs text-muted-foreground">
            Vérifiez le récapitulatif. En terminant, il est enregistré dans l&apos;historique et les priorités s&apos;affichent
            sur le dashboard de chacun.
          </p>
        </div>
        <Button
          size="lg"
          className="shadow-button"
          onClick={async () => {
            await closeMeeting(meeting.id);
            toast.success("Meeting terminé", { description: "Bonne semaine à toute l'équipe !" });
          }}
        >
          <Check /> Terminer le meeting
        </Button>
      </div>
      <Recap meeting={meeting} summary={summary} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live meeting                                                        */
/* ------------------------------------------------------------------ */

export interface Step {
  key: string;
  label: string;
  project?: Project;
}

export function useSteps(): Step[] {
  const projects = useProjects();
  return useMemo(
    () => [
      { key: "review", label: "Tour d'horizon" },
      ...projects.map((p) => ({ key: p.id, label: p.name, project: p })),
      { key: "priorities", label: "Priorités" },
      { key: "close", label: "Clôture" },
    ],
    [projects],
  );
}

export function useElapsed(since: string | null): string {
  const now = useSecondTick();
  if (!since) return "00:00";
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function Stepper({ steps, current, onChange }: { steps: Step[]; current: string; onChange: (key: string) => void }) {
  const index = Math.max(0, steps.findIndex((s) => s.key === current));
  return (
    <nav aria-label="Étapes du meeting" className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {steps.map((s, i) => {
        const active = i === index;
        const past = i < index;
        return (
          <button
            key={s.key}
            type="button"
            aria-current={active ? "step" : undefined}
            onClick={() => onChange(s.key)}
            className={cn(
              "group flex h-8 shrink-0 items-center gap-2 rounded-lg pr-3 pl-1.5 text-[13px] font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sun-300 focus-visible:outline-none",
              active ? "bg-white text-navy-900 shadow-sm" : "text-navy-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-md text-[11px] font-semibold tabular",
                active ? "bg-navy-900 text-white" : past ? "bg-teal-500/90 text-white" : "bg-white/10 text-navy-200",
              )}
            >
              {past ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

/** "Pendant le meeting": walk through the projects, add & assign, set priorities. */
export function LiveMeeting({ meeting, steps, step, onStep }: { meeting: Meeting; steps: Step[]; step: string; onStep: (k: string) => void }) {
  const index = Math.max(0, steps.findIndex((s) => s.key === step));
  const current = steps[index];
  const buckets = useMeetingBuckets(meeting.week_start);
  const topRef = useRef<HTMLDivElement>(null);

  const go = (i: number) => {
    onStep(steps[Math.min(steps.length - 1, Math.max(0, i))].key);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div ref={topRef} className="scroll-mt-44">
      <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-12">
        <div key={current.key} className={cn("animate-fade-up min-w-0", current.key === "close" ? "xl:col-span-12" : "xl:col-span-8")}>
          {current.key === "review" && <Buckets buckets={buckets} />}
          {current.project && <ProjectStep project={current.project} meeting={meeting} />}
          {current.key === "priorities" && <PrioritiesStep meeting={meeting} />}
          {current.key === "close" && <CloseStep meeting={meeting} />}

          <div className="mt-5 flex items-center justify-between">
            <Button variant="ghost" disabled={index === 0} onClick={() => go(index - 1)}>
              <ArrowLeft /> {index > 0 ? steps[index - 1].label : "Précédent"}
            </Button>
            {index < steps.length - 1 && (
              <Button onClick={() => go(index + 1)} className="shadow-button">
                {steps[index + 1].label} <ArrowRight />
              </Button>
            )}
          </div>
        </div>

        {current.key !== "close" && (
          <aside className="min-w-0 xl:sticky xl:top-[160px] xl:col-span-4">
            <Agenda
              weekStart={meeting.week_start}
              meetingId={meeting.id}
              projectId={current.project?.id ?? null}
              showDecisions
            />
          </aside>
        )}
      </div>
    </div>
  );
}
