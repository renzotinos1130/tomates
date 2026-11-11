"use client";

import { CalendarDays } from "lucide-react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { AssigneePicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker } from "@/components/kit/pickers";
import { DueLabel, PriorityStar } from "@/components/kit/pills";
import { PriorityIcon } from "@/components/kit/priority-icon";
import { ProjectIcon } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { PRIORITY_META, STATUS_META } from "@/lib/constants";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import type { DateOnly, ID, TaskPriority, TaskStatus } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";

export interface TaskDraft {
  project_id: ID;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: ID | null;
  due_date: DateOnly | null;
  weekPriority: boolean;
}

export const chipClass =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-navy-900/10 bg-card px-2 text-xs font-medium text-navy-700 transition-colors hover:bg-accent focus-ring data-[state=open]:bg-accent";

/** Row of property chips used wherever a task is being drafted. */
export function DraftControls({
  draft,
  onChange,
  show = { project: true, status: true, priority: true, assignee: true, due: true, week: true },
  className,
}: {
  draft: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  show?: Partial<Record<"project" | "status" | "priority" | "assignee" | "due" | "week", boolean>>;
  className?: string;
}) {
  const projects = useProjectsMap();
  const members = useMembersMap();
  const now = useNow();
  const project = projects[draft.project_id];
  const assignee = draft.assignee_id ? members[draft.assignee_id] : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {show.project && project && (
        <ProjectPicker value={draft.project_id} onChange={(project_id) => onChange({ project_id })}>
          <button type="button" className={chipClass}>
            <ProjectIcon project={project} size="xs" className="-ml-0.5" />
            {project.name}
          </button>
        </ProjectPicker>
      )}
      {show.status && (
        <StatusPicker value={draft.status} onChange={(status) => onChange({ status })}>
          <button type="button" className={chipClass}>
            <StatusIcon status={draft.status} size={14} />
            {STATUS_META[draft.status].label}
          </button>
        </StatusPicker>
      )}
      {show.assignee && (
        <AssigneePicker value={draft.assignee_id} onChange={(assignee_id) => onChange({ assignee_id })}>
          <button type="button" className={chipClass}>
            <MemberAvatar member={assignee} size="xs" className="-ml-0.5" />
            {assignee ? firstName(assignee.full_name) : "Responsable"}
          </button>
        </AssigneePicker>
      )}
      {show.priority && (
        <PriorityPicker value={draft.priority} onChange={(priority) => onChange({ priority })}>
          <button type="button" className={chipClass}>
            <PriorityIcon priority={draft.priority} size={14} />
            {PRIORITY_META[draft.priority].label}
          </button>
        </PriorityPicker>
      )}
      {show.due && (
        <DuePicker value={draft.due_date} onChange={(due_date) => onChange({ due_date })}>
          <button type="button" className={chipClass}>
            {draft.due_date ? (
              <DueLabel date={draft.due_date} now={now} className="font-medium" />
            ) : (
              <>
                <CalendarDays className="size-3.5 text-navy-400" />
                Échéance
              </>
            )}
          </button>
        </DuePicker>
      )}
      {show.week && (
        <button
          type="button"
          aria-pressed={draft.weekPriority}
          onClick={() => onChange({ weekPriority: !draft.weekPriority })}
          className={cn(chipClass, draft.weekPriority && "border-sun-300 bg-sun-50 text-sun-800 hover:bg-sun-100")}
        >
          <PriorityStar active={draft.weekPriority} className="size-3.5" />
          Priorité de la semaine
        </button>
      )}
    </div>
  );
}
