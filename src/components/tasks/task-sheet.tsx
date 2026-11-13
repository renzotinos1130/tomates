"use client";

import { ArrowUp, CalendarDays, ListChecks, MessageSquare, MoreHorizontal, Plus, Trash2, X } from "@/components/kit/icons";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AutoTextarea } from "@/components/kit/auto-textarea";
import { ProgressLine } from "@/components/kit/progress";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker } from "@/components/kit/pickers";
import { DueLabel, Kbd, PriorityPill, PriorityStar, StatusLabel } from "@/components/kit/pills";
import { ProjectIcon } from "@/components/kit/project-icon";
import { TaskCheck } from "@/components/kit/task-check";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeEventInTask } from "@/lib/activity";
import { relativeTime } from "@/lib/dates";
import { useEditablePriorityIds, useMe, useMembersMap, useNow, useProjectsMap, useTask } from "@/lib/hooks";
import {
  addComment,
  addSubtask,
  deleteComment,
  deleteSubtask,
  loadTaskHistory,
  setStatus,
  setWeekPriority,
  toggleDone,
  ui,
  updateSubtask,
  updateTask,
  useApp,
} from "@/lib/store";
import type { Comment, Task, TaskEvent } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";
import { Attachments, DropVeil, useFileIntake } from "./attachments";
import { TaskDropdownMenu } from "./task-menu";

const propButton =
  "inline-flex h-8 max-w-full items-center gap-2 rounded-lg px-2 -ml-2 text-[13px] text-navy-800 transition-colors hover:bg-navy-900/[0.05] focus-ring data-[state=open]:bg-navy-900/[0.05]";

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] items-center gap-2">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SectionTitle({ icon, children, right }: { icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-navy-400">{icon}</span>
      <h3 className="text-[13px] font-semibold text-navy-900">{children}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/* ------------------------------ subtasks ----------------------------- */

function Subtasks({ task }: { task: Task }) {
  const all = useApp((s) => s.subtasks);
  const list = useMemo(
    () =>
      Object.values(all)
        .filter((s) => s.task_id === task.id)
        .sort((a, b) => a.position - b.position),
    [all, task.id],
  );
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const done = list.filter((s) => s.done).length;

  const submit = () => {
    if (!draft.trim()) return;
    void addSubtask(task.id, draft);
    setDraft("");
  };

  return (
    <section>
      <SectionTitle
        icon={<ListChecks className="size-4" />}
        right={
          list.length > 0 && (
            <div className="flex items-center gap-2">
              <ProgressLine className="w-14" done={done} total={list.length} label={`${done} sous-tâches terminées sur ${list.length}`} />
              <span className="text-xs text-muted-foreground tabular">
                {done}/{list.length}
              </span>
            </div>
          )
        }
      >
        Sous-tâches
      </SectionTitle>
      <ul className="space-y-0.5">
        {list.map((s) => (
          <li key={s.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1 -mx-2 hover:bg-navy-900/[0.03]">
            <TaskCheck done={s.done} size="sm" onToggle={() => void updateSubtask(s.id, { done: !s.done })} />
            <input
              defaultValue={s.title}
              key={s.title}
              aria-label="Titre de la sous-tâche"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.title) void updateSubtask(s.id, { title: v });
                else e.target.value = s.title;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[13px] outline-none",
                s.done ? "text-muted-foreground line-through decoration-navy-300" : "text-navy-800",
              )}
            />
            <button
              type="button"
              aria-label="Supprimer la sous-tâche"
              onClick={() => void deleteSubtask(s.id)}
              className="flex size-6 items-center justify-center rounded-md text-navy-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-coral-50 hover:text-coral-600 focus-visible:opacity-100 focus-ring"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {adding || list.length > 0 ? (
        <div className="-mx-2 mt-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1">
          <Plus className="size-4 text-navy-300" />
          <input
            autoFocus={adding && list.length === 0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setDraft("");
                setAdding(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={submit}
            placeholder="Ajouter une sous-tâche"
            aria-label="Nouvelle sous-tâche"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-navy-400"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="-ml-2 inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:bg-navy-900/[0.05] hover:text-navy-800 focus-ring"
        >
          <Plus className="size-3.5" /> Ajouter une sous-tâche
        </button>
      )}
    </section>
  );
}

/* ------------------------------ activity ----------------------------- */

type TimelineItem = { at: string; key: string } & ({ type: "event"; event: TaskEvent } | { type: "comment"; comment: Comment });

function Activity({ task }: { task: Task }) {
  const now = useNow();
  const me = useMe();
  const members = useMembersMap();
  const projects = useProjectsMap();
  const events = useApp((s) => s.task_events);
  const comments = useApp((s) => s.comments);

  useEffect(() => {
    void loadTaskHistory(task.id);
  }, [task.id]);

  const items = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    for (const e of Object.values(events)) {
      if (e.task_id === task.id && e.kind !== "commented") out.push({ type: "event", event: e, at: e.created_at, key: e.id });
    }
    for (const c of Object.values(comments)) {
      if (c.task_id === task.id) out.push({ type: "comment", comment: c, at: c.created_at, key: c.id });
    }
    return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }, [events, comments, task.id]);

  return (
    <section>
      <SectionTitle icon={<MessageSquare className="size-4" />}>Activité</SectionTitle>
      <ol className="relative space-y-3">
        {items.map((item) => {
          if (item.type === "event") {
            const actor = item.event.actor_id ? members[item.event.actor_id] : null;
            return (
              <li key={item.key} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <span className="mt-[3px] flex size-6 shrink-0 items-center justify-center">
                  <span className="size-1.5 rounded-full bg-navy-200" />
                </span>
                <p className="pt-1 leading-snug">
                  <span className="font-medium text-navy-700">{actor ? firstName(actor.full_name) : "Quelqu'un"}</span>{" "}
                  {describeEventInTask(item.event, { members, projects })}
                  <span className="text-navy-400"> · {relativeTime(item.at, now)}</span>
                </p>
              </li>
            );
          }
          const c = item.comment;
          const author = c.author_id ? members[c.author_id] : null;
          return (
            <li key={item.key} className="group flex items-start gap-2.5">
              <MemberAvatar member={author} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-paper-100 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-navy-900">{author?.full_name ?? "Ancien membre"}</span>
                  <span className="text-[11px] text-navy-400">{relativeTime(c.created_at, now)}</span>
                  {c.author_id === me?.id && (
                    <button
                      type="button"
                      aria-label="Supprimer le commentaire"
                      onClick={() =>
                        ui.confirm({
                          title: "Supprimer ce commentaire ?",
                          confirmLabel: "Supprimer",
                          destructive: true,
                          onConfirm: () => deleteComment(c.id),
                        })
                      }
                      className="ml-auto text-navy-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-coral-600 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-navy-800">{c.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Composer({ taskId }: { taskId: string }) {
  const me = useMe();
  const [body, setBody] = useState("");
  const send = () => {
    if (!body.trim()) return;
    void addComment(taskId, body);
    setBody("");
  };
  return (
    <div className="border-t bg-card px-5 py-3">
      <div className="flex items-end gap-2.5">
        <MemberAvatar member={me} size="sm" className="mb-1" />
        <div className="flex min-w-0 flex-1 items-end gap-2 rounded-xl border border-navy-900/10 bg-paper-50 py-1.5 pr-1.5 pl-3 transition-shadow focus-within:border-teal-500/60 focus-within:ring-3 focus-within:ring-teal-500/15">
          <AutoTextarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Écrire un commentaire…"
            aria-label="Écrire un commentaire"
            className="max-h-40 py-1 text-[13px] leading-relaxed text-navy-800"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" aria-label="Publier le commentaire" disabled={!body.trim()} onClick={send}>
                <ArrowUp />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Publier <Kbd className="border-white/20 bg-white/10 text-white">⌘↵</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- body ------------------------------- */

function TaskBody({ task }: { task: Task }) {
  const now = useNow();
  const members = useMembersMap();
  const projects = useProjectsMap();
  const starred = useEditablePriorityIds().has(task.id);
  const project = projects[task.project_id];
  const assignee = task.assignee_id ? members[task.assignee_id] : null;
  const creator = task.created_by ? members[task.created_by] : null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const titleFocused = useRef(false);
  const descFocused = useRef(false);
  // Follow remote edits unless the field is being typed in.
  useEffect(() => {
    if (!titleFocused.current) setTitle(task.title);
  }, [task.title]);
  useEffect(() => {
    if (!descFocused.current) setDescription(task.description);
  }, [task.description]);

  const commitTitle = () => {
    const v = title.trim().replace(/\s*\n+\s*/g, " ");
    if (v && v !== task.title) void updateTask(task.id, { title: v });
    else setTitle(task.title);
  };
  const commitDescription = () => {
    if (description !== task.description) void updateTask(task.id, { description: description.trimEnd() });
  };
  const intake = useFileIntake(task.id);

  return (
    // Files dropped anywhere on the panel, or pasted into it, are attached to the task.
    <div className="relative flex min-h-0 flex-1 flex-col" {...intake.handlers}>
      {intake.over && <DropVeil />}
      {/* Top bar */}
      <div className="flex h-13 shrink-0 items-center gap-2 border-b px-4 py-2.5">
        {project && (
          <Link
            href={`/projets/${project.slug}`}
            onClick={() => ui.openTask(null)}
            className="inline-flex min-w-0 items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-[13px] font-medium text-navy-700 transition-colors hover:bg-navy-900/[0.05] focus-ring"
          >
            <ProjectIcon project={project} size="sm" />
            <span className="truncate">{project.name}</span>
          </Link>
        )}
        {task.archived_at && (
          <span className="rounded-[4px] bg-navy-100 px-1.5 py-0.5 text-[11px] font-medium text-navy-600">Archivée</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={starred}
                aria-label="Priorité de la semaine"
                onClick={() => void setWeekPriority(task.id, !starred)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors focus-ring",
                  starred ? "bg-sun-50 text-sun-800 hover:bg-sun-100" : "text-navy-500 hover:bg-navy-900/[0.05]",
                )}
              >
                <PriorityStar active={starred} />
                <span className="hidden sm:inline">{starred ? "Priorité de la semaine" : "Prioriser"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {starred ? "Retirer des priorités de la semaine" : "Ajouter aux priorités de la semaine"}
            </TooltipContent>
          </Tooltip>
          <TaskDropdownMenu task={task} withOpen={false}>
            <button
              type="button"
              aria-label="Plus d'actions"
              className="flex size-8 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-900/[0.05] focus-ring"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </TaskDropdownMenu>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => ui.openTask(null)}
            className="flex size-8 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-navy-900/[0.05] focus-ring"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
        <div className="flex items-start gap-3">
          <TaskCheck done={task.status === "done"} onToggle={() => void toggleDone(task.id)} className="mt-[7px]" />
          <AutoTextarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => (titleFocused.current = true)}
            onBlur={() => {
              titleFocused.current = false;
              commitTitle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            aria-label="Titre de la tâche"
            maxLength={500}
            className={cn(
              "text-xl leading-snug font-semibold tracking-tight",
              task.status === "done" ? "text-navy-400" : "text-navy-900",
            )}
          />
        </div>

        <div className="space-y-0.5">
          <PropRow label="Statut">
            <StatusPicker value={task.status} onChange={(s) => void setStatus(task.id, s)}>
              <button type="button" className={propButton}>
                <StatusLabel status={task.status} />
              </button>
            </StatusPicker>
          </PropRow>
          <PropRow label="Responsable">
            <AssigneePicker value={task.assignee_id} onChange={(assignee_id) => void updateTask(task.id, { assignee_id })}>
              <button type="button" className={propButton}>
                <MemberAvatar member={assignee} size="sm" />
                <span className={cn("truncate", !assignee && "text-muted-foreground")}>
                  {assignee?.full_name ?? "Non assignée"}
                </span>
              </button>
            </AssigneePicker>
          </PropRow>
          <PropRow label="Priorité">
            <PriorityPicker value={task.priority} onChange={(priority) => void updateTask(task.id, { priority })}>
              <button type="button" className={propButton}>
                <PriorityPill priority={task.priority} className="text-[13px] font-normal" />
              </button>
            </PriorityPicker>
          </PropRow>
          <PropRow label="Échéance">
            <DuePicker value={task.due_date} onChange={(due_date) => void updateTask(task.id, { due_date })}>
              <button type="button" className={propButton}>
                {task.due_date ? (
                  <DueLabel date={task.due_date} done={task.status === "done"} now={now} className="text-[13px]" />
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="size-3.5" /> Aucune échéance
                  </span>
                )}
              </button>
            </DuePicker>
          </PropRow>
          <PropRow label="Projet">
            <ProjectPicker value={task.project_id} onChange={(project_id) => void updateTask(task.id, { project_id })}>
              <button type="button" className={propButton}>
                {project && <ProjectIcon project={project} size="xs" />}
                <span className="truncate">{project?.name ?? "—"}</span>
              </button>
            </ProjectPicker>
          </PropRow>
        </div>

        <section>
          <AutoTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => (descFocused.current = true)}
            onBlur={() => {
              descFocused.current = false;
              commitDescription();
            }}
            placeholder="Ajouter une description, du contexte, des liens…"
            aria-label="Description"
            minRows={3}
            className="-mx-3 w-[calc(100%+1.5rem)] rounded-xl px-3 py-2.5 text-sm leading-relaxed text-navy-800 transition-colors hover:bg-navy-900/[0.025] focus:bg-paper-100"
          />
        </section>

        <Subtasks task={task} />
        <Attachments task={task} />
        <Activity task={task} />

        <p className="pb-2 text-[11px] text-navy-400">
          Créée {creator ? `par ${creator.full_name} ` : ""}
          {relativeTime(task.created_at, now)}
          {task.completed_at ? ` · terminée ${relativeTime(task.completed_at, now)}` : ""}
        </p>
      </div>

      <Composer taskId={task.id} />
    </div>
  );
}

/** Right-hand panel with everything about one task. Mounted once in the shell. */
export function TaskSheet() {
  const openTaskId = useApp((s) => s.openTaskId);
  const task = useTask(openTaskId);
  // Keep the last task rendered while the sheet animates out.
  const [shown, setShown] = useState<Task | null>(null);
  if (task && task !== shown) setShown(task);
  const current = task ?? shown;

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && ui.openTask(null)}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-full gap-0 border-l-0 p-0 shadow-pop data-[side=right]:w-full data-[side=right]:sm:max-w-[580px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{current?.title ?? "Tâche"}</SheetTitle>
        <SheetDescription className="sr-only">Détails de la tâche</SheetDescription>
        {current && <TaskBody key={current.id} task={current} />}
      </SheetContent>
    </Sheet>
  );
}
