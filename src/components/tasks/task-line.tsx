"use client";

import { ListChecks, MessageSquare, Paperclip } from "@/components/kit/icons";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { AssigneePicker, StatusPicker } from "@/components/kit/pickers";
import { DueLabel, PriorityStar, StatusLabel } from "@/components/kit/pills";
import { PriorityIcon } from "@/components/kit/priority-icon";
import { ProjectChip } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { TaskCheck } from "@/components/kit/task-check";
import { STATUS_META } from "@/lib/constants";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import { setStatus, toggleDone, ui, updateTask } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskContextMenu } from "./task-menu";
import type { TaskCounts } from "./use-task-counts";

export function TaskIndicators({ counts, className }: { counts: TaskCounts; className?: string }) {
  if (!counts.subTotal && !counts.comments && !counts.files) return null;
  return (
    <span className={cn("flex shrink-0 items-center gap-2 text-[11px] text-navy-400 tabular", className)}>
      {counts.subTotal > 0 && (
        <span className="inline-flex items-center gap-0.5" title="Sous-tâches">
          <ListChecks className="size-3" />
          {counts.subDone}/{counts.subTotal}
        </span>
      )}
      {counts.comments > 0 && (
        <span className="inline-flex items-center gap-0.5" title="Commentaires">
          <MessageSquare className="size-3" />
          {counts.comments}
        </span>
      )}
      {counts.files > 0 && (
        <span className="inline-flex items-center gap-0.5" title="Fichiers">
          <Paperclip className="size-3" />
          {counts.files}
        </span>
      )}
    </span>
  );
}

/**
 * Compact task line, used in every aggregate view (dashboard, my tasks,
 * meeting). Click opens the detail panel; status and assignee edit in place.
 * It adapts to the width of its container (not the viewport): in a narrow
 * card the project and due date move under the title.
 */
export function TaskLine({
  task,
  counts,
  starred = false,
  show = {},
  trailing,
  badge,
  className,
}: {
  task: Task;
  counts?: TaskCounts;
  starred?: boolean;
  show?: {
    project?: boolean;
    assignee?: boolean;
    status?: boolean;
    due?: boolean;
    priority?: boolean;
    /** Leading control: a checkbox to complete, the status glyph, or nothing. */
    lead?: "check" | "status" | "none";
    /** Strike finished tasks through (off in "accomplished" lists). */
    strike?: boolean;
  };
  /** Extra controls rendered at the far right (e.g. the star toggle in meetings). */
  trailing?: React.ReactNode;
  /** Small tag after the title (e.g. "Nouveau"). */
  badge?: React.ReactNode;
  className?: string;
}) {
  const s = { project: true, assignee: true, status: true, due: true, priority: false, lead: "check", strike: true, ...show };
  const now = useNow();
  const members = useMembersMap();
  const projects = useProjectsMap();
  const done = task.status === "done";
  const meta = (s.project || (s.due && task.due_date)) as boolean;

  return (
    <div className="@container/line">
      <TaskContextMenu task={task}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => ui.openTask(task.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target === e.currentTarget) ui.openTask(task.id);
          }}
          className={cn(
            "group/line flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-navy-900/[0.035] focus-ring",
            className,
          )}
        >
          {s.lead === "check" && <TaskCheck done={done} onToggle={() => void toggleDone(task.id)} />}
          {s.lead === "status" && (
            // The glyph is the control: click it to change the status (Linear's way).
            <StatusPicker value={task.status} onChange={(v) => void setStatus(task.id, v)}>
              <button
                type="button"
                aria-label={`Statut : ${STATUS_META[task.status].label}. Changer`}
                title={STATUS_META[task.status].label}
                className="-m-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-navy-900/[0.07] focus-ring"
              >
                <StatusIcon status={task.status} />
              </button>
            </StatusPicker>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              {s.priority && <PriorityIcon priority={task.priority} size={14} />}
              <span
                className={cn(
                  "line-clamp-2 min-w-0 text-[13px] leading-snug",
                  done && s.strike ? "text-navy-400 line-through decoration-navy-200" : "font-medium text-navy-900",
                )}
              >
                {task.title}
              </span>
              {badge}
              {starred && <PriorityStar active className="size-3.5 shrink-0" />}
              {counts && <TaskIndicators counts={counts} className="hidden @3xl/line:flex" />}
            </div>
            {meta && (
              <div className="mt-0.5 flex items-center gap-2.5 @xl/line:hidden">
                {s.project && <ProjectChip project={projects[task.project_id]} />}
                {s.due && task.due_date && <DueLabel date={task.due_date} done={done} now={now} icon={false} />}
              </div>
            )}
          </div>
          {s.project && (
            <ProjectChip project={projects[task.project_id]} className="hidden w-[104px] shrink-0 @xl/line:inline-flex" />
          )}
          {s.due && (
            <span className="hidden w-[76px] shrink-0 items-center @xl/line:flex">
              {task.due_date && <DueLabel date={task.due_date} done={done} now={now} />}
            </span>
          )}
          {s.status && (
            <span className="hidden w-[108px] shrink-0 items-center @xl/line:flex">
              <StatusPicker value={task.status} onChange={(v) => void setStatus(task.id, v)} align="end">
                <button
                  type="button"
                  aria-label="Changer le statut"
                  className="-mx-1.5 flex h-7 items-center rounded-md px-1.5 transition-colors hover:bg-navy-900/[0.05] focus-ring"
                >
                  <StatusLabel status={task.status} />
                </button>
              </StatusPicker>
            </span>
          )}
          {s.assignee && (
            <AssigneePicker
              value={task.assignee_id}
              onChange={(assignee_id) => void updateTask(task.id, { assignee_id })}
              align="end"
            >
              <button type="button" aria-label="Changer le responsable" className="shrink-0 rounded-full focus-ring">
                <MemberAvatar member={task.assignee_id ? members[task.assignee_id] : null} size="sm" tooltip />
              </button>
            </AssigneePicker>
          )}
          {trailing}
        </div>
      </TaskContextMenu>
    </div>
  );
}
