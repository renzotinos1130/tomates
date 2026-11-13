"use client";

import { ArrowUpRight } from "@/components/kit/icons";
import { StatusPicker } from "@/components/kit/pickers";
import { DueLabel, PriorityStar } from "@/components/kit/pills";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { ProjectChip } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { TaskContextMenu } from "@/components/tasks/task-menu";
import { STATUS_META } from "@/lib/constants";
import { useProjectsMap } from "@/lib/hooks";
import { setStatus, ui } from "@/lib/store";
import type { ID, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One task, as a numbered ticket: its rank on the stub, then what it is, how
 * it stands, where it belongs and when it is due. The whole ticket opens the
 * task; the status changes in place, from its own word.
 */
function Ticket({ task, rank, starred, now }: { task: Task; rank: number; starred: boolean; now: Date }) {
  const projects = useProjectsMap();
  const status = STATUS_META[task.status];
  const lead = rank === 1;
  return (
    <TaskContextMenu task={task}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => ui.openTask(task.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) ui.openTask(task.id);
        }}
        className="gw-panel first-ticket focus-ring"
        data-lead={lead ? "" : undefined}
      >
        <span className="first-stub tabular" aria-hidden="true">
          {rank}
        </span>
        <span className="first-body">
          {lead && (
            <span className="first-eyebrow" aria-hidden="true">
              À prendre en premier
            </span>
          )}
          <span className="first-title">{task.title}</span>
          <span className="first-meta">
            <StatusPicker value={task.status} onChange={(v) => void setStatus(task.id, v)}>
              <button type="button" aria-label={`Statut : ${status.label}. Changer`} title="Changer le statut" className={cn("first-status focus-ring", status.text)}>
                <StatusIcon status={task.status} size={14} />
                {status.label}
              </button>
            </StatusPicker>
            <ProjectChip project={projects[task.project_id]} />
            {task.due_date && <DueLabel date={task.due_date} now={now} />}
            {starred && (
              <span className="inline-flex items-center gap-1 text-xs text-navy-700">
                <PriorityStar active className="size-3.5 shrink-0" />
                <span className="first-wide">Priorité de la semaine</span>
              </span>
            )}
          </span>
        </span>
        <ArrowUpRight className="first-go" aria-hidden="true" />
      </div>
    </TaskContextMenu>
  );
}

/**
 * « À prendre en premier » : my three next tasks, as three numbered tickets
 * rather than a list in a box. The first is the one to take now: taller, its
 * number on a tomato stub, like the date of the meeting's ticket at the foot
 * of the page. The two after it are slimmer, their number on the glass.
 */
export function FirstUp({ tasks, priorityIds, now }: { tasks: Task[]; priorityIds: Set<ID>; now: Date }) {
  return (
    <section className="first-up" aria-labelledby="dash-next">
      <h2 id="dash-next" className="sr-only">
        À prendre en premier
      </h2>
      {tasks.length > 0 ? (
        <ol className="first-list">
          {tasks.map((t, i) => (
            <li key={t.id}>
              <Ticket task={t} rank={i + 1} starred={priorityIds.has(t.id)} now={now} />
            </li>
          ))}
        </ol>
      ) : (
        // Nothing left to do: the ripe tomato keeps the ticket company.
        <div className="gw-panel first-ticket first-empty">
          <span className="first-stub" aria-hidden="true">
            <PixelTomato size={32} decorative />
          </span>
          <span className="first-body">
            <span className="first-eyebrow" aria-hidden="true">
              À prendre en premier
            </span>
            <span className="first-title">Tout est fait. Belle récolte.</span>
          </span>
        </div>
      )}
    </section>
  );
}
