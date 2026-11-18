"use client";

import { useMemo, useState } from "react";
import { Hourglass, Plus, X } from "@/components/kit/icons";
import { StatusIcon } from "@/components/kit/status-icon";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProjects } from "@/lib/hooks";
import { setDependencies, ui, useApp } from "@/lib/store";
import { holdsOthers, pendingDependencies, wouldLoop } from "@/lib/task-logic";
import type { ID, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Dependencies: a task can depend on others, and stays blocked until they are
 * finished (the database keeps the rule; lib/task-logic.ts mirrors it).
 *
 *  - `WaitingNote`     « Attend « X » », beside a task in a list.
 *  - `DependsOn`       the tasks a task depends on, in its panel: each opens,
 *                      each can be taken off, and a picker adds more.
 *  - `Unblocks`        the tasks that wait for this one.
 */

const SEPARATOR = "\u0001";

/** The titles of the tasks `task` is still waiting for. Changes only when they do. */
export function useWaitingFor(task: Pick<Task, "depends_on" | "waiting">): string[] {
  const joined = useApp((s) =>
    task.waiting
      ? pendingDependencies(task, (id) => s.tasks[id])
          .map((t) => t.title)
          .join(SEPARATOR)
      : "",
  );
  return useMemo(() => (joined ? joined.split(SEPARATOR) : []), [joined]);
}

/** « « A » », or « « A » et 2 autres ». */
export function waitingFor(titles: string[]): string {
  if (titles.length === 0) return "une autre tâche";
  const rest = titles.length - 1;
  return rest > 0 ? `« ${titles[0]} » et ${rest} ${rest > 1 ? "autres" : "autre"}` : `« ${titles[0]} »`;
}

/** Beside a task that waits: what it waits for. Nothing for a task that does not wait. */
export function WaitingNote({ task, className }: { task: Pick<Task, "depends_on" | "waiting">; className?: string }) {
  const titles = useWaitingFor(task);
  if (!task.waiting) return null;
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1 text-[11px] text-navy-500", className)}
      title={`En attente : se débloquera quand ${titles.length > 1 ? `${titles.length} tâches seront terminées` : `${waitingFor(titles)} sera terminée`}`}
    >
      <Hourglass className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">Attend {waitingFor(titles)}</span>
    </span>
  );
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** The tasks `task` could depend on, by project: its own first. Open tasks only, and never one that already waits for it. */
function Candidates({ task }: { task: Task }) {
  const tasks = useApp((s) => s.tasks);
  const projects = useProjects();
  const chosen = useMemo(() => new Set(task.depends_on), [task.depends_on]);
  const groups = useMemo(() => {
    const find = (id: ID) => tasks[id];
    const eligible = Object.values(tasks)
      .filter((t) => t.id !== task.id && (chosen.has(t.id) || (holdsOthers(t) && !wouldLoop(task.id, t.id, find))))
      .sort((a, b) => a.title.localeCompare(b.title, "fr"));
    return [...projects]
      .sort((a, b) => Number(b.id === task.project_id) - Number(a.id === task.project_id))
      .map((p) => ({ project: p, tasks: eligible.filter((t) => t.project_id === p.id) }))
      .filter((g) => g.tasks.length > 0);
  }, [tasks, projects, chosen, task.id, task.project_id]);

  const toggle = (id: ID) =>
    void setDependencies(task.id, chosen.has(id) ? task.depends_on.filter((d) => d !== id) : [...task.depends_on, id]);

  return (
    // Titles only: an item is found by what it is called, never by its id.
    <Command filter={(_value, search, keywords) => (fold(keywords?.join(" ") ?? "").includes(fold(search.trim())) ? 1 : 0)}>
      <CommandInput placeholder="Chercher une tâche…" aria-label="Chercher la tâche à attendre" />
      <CommandList className="max-h-64">
        <CommandEmpty>Aucune tâche à ce nom.</CommandEmpty>
        {groups.map(({ project, tasks: list }) => (
          <CommandGroup key={project.id} heading={project.name}>
            {list.map((t) => (
              <CommandItem key={t.id} value={t.id} keywords={[t.title]} onSelect={() => toggle(t.id)} data-checked={chosen.has(t.id)}>
                <StatusIcon status={t.status} size={14} />
                <span className="truncate">{t.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

/** Opens the list of tasks a task can depend on. Ticking one adds it; ticking it again takes it off. */
export function DependencyPicker({ task, children }: { task: Task; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" aria-label="Tâches à attendre">
        {open && <Candidates task={task} />}
      </PopoverContent>
    </Popover>
  );
}

const chip = "inline-flex h-7 max-w-full min-w-0 items-center rounded-lg bg-navy-900/[0.05] text-[13px] text-navy-800";
const chipOpen = "inline-flex h-full min-w-0 items-center gap-1.5 px-2 transition-colors hover:bg-navy-900/[0.06] focus-ring";

/** A task named in a panel: its status, its title; a click opens it. */
function TaskChip({ task, onRemove }: { task: Task; onRemove?: () => void }) {
  return (
    <span className={chip}>
      <button
        type="button"
        onClick={() => ui.openTask(task.id)}
        title={`Ouvrir « ${task.title} »`}
        className={cn(chipOpen, onRemove ? "rounded-l-lg pr-1" : "rounded-lg")}
      >
        <StatusIcon status={task.status} size={14} />
        <span className={cn("truncate", task.status === "done" && "text-navy-400 line-through decoration-navy-200")}>{task.title}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Ne plus dépendre de « ${task.title} »`}
          title="Retirer la dépendance"
          className="flex size-7 shrink-0 items-center justify-center rounded-r-lg text-navy-400 transition-colors hover:bg-navy-900/[0.08] hover:text-navy-800 focus-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}

/** What a task depends on, in its panel. */
export function DependsOn({ task }: { task: Task }) {
  const tasks = useApp((s) => s.tasks);
  const list = task.depends_on.map((id) => tasks[id]).filter((t): t is Task => !!t);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 py-0.5" role="group" aria-label="Dépend de">
      {list.map((d) => (
        <TaskChip key={d.id} task={d} onRemove={() => void setDependencies(task.id, task.depends_on.filter((id) => id !== d.id))} />
      ))}
      <DependencyPicker task={task}>
        {list.length ? (
          <button
            type="button"
            aria-label="Ajouter une dépendance"
            title="Ajouter une dépendance"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-900/[0.05] hover:text-navy-800 focus-ring data-[state=open]:bg-navy-900/[0.05]"
          >
            <Plus className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Ajouter une dépendance"
            className="-ml-2 inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:bg-navy-900/[0.05] focus-ring data-[state=open]:bg-navy-900/[0.05]"
          >
            <Hourglass className="size-3.5" /> Aucune dépendance
          </button>
        )}
      </DependencyPicker>
    </div>
  );
}

/** The open tasks that depend on `taskId`. */
export function useDependents(taskId: ID): Task[] {
  const tasks = useApp((s) => s.tasks);
  return useMemo(
    () => Object.values(tasks).filter((t) => !t.archived_at && (t.depends_on ?? []).includes(taskId)),
    [tasks, taskId],
  );
}

/** The tasks that wait for this one: finishing it frees them. */
export function Unblocks({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 py-0.5" role="group" aria-label="Débloque">
      {tasks.map((t) => (
        <TaskChip key={t.id} task={t} />
      ))}
    </div>
  );
}
