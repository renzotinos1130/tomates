"use client";

import { DndContext, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { CountBadge, DueLabel, PriorityStar } from "@/components/kit/pills";
import { PriorityIcon } from "@/components/kit/priority-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { TaskIndicators } from "@/components/tasks/task-line";
import { TaskContextMenu } from "@/components/tasks/task-menu";
import type { TaskCounts } from "@/components/tasks/use-task-counts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PRIORITY_META, STATUS_META } from "@/lib/constants";
import { useMembersMap, useNow } from "@/lib/hooks";
import { archiveDone, createTask, ui } from "@/lib/store";
import type { ID, Task, TaskStatus } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { columnId, type Board, type BoardFilters } from "./use-board";

function CardContent({
  task,
  counts,
  starred,
  overlay,
}: {
  task: Task;
  counts: TaskCounts;
  starred: boolean;
  overlay?: boolean;
}) {
  const now = useNow();
  const members = useMembersMap();
  const done = task.status === "done";
  return (
    <div
      className={cn(
        "rounded-xl bg-card p-3 transition-shadow duration-200",
        overlay ? "rotate-[1.5deg] shadow-drag" : "shadow-card hover:shadow-card-hover",
      )}
    >
      <div className="flex items-start gap-2">
        <p
          className={cn(
            "line-clamp-3 min-w-0 flex-1 text-[13px] leading-snug",
            done ? "text-navy-400 line-through decoration-navy-200" : "font-medium text-navy-900",
          )}
        >
          {task.title}
        </p>
        {starred && <PriorityStar active className="mt-0.5 size-3.5 shrink-0" />}
      </div>
      <div className="mt-2.5 flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span title={`Priorité ${PRIORITY_META[task.priority].label.toLowerCase()}`}>
            <PriorityIcon priority={task.priority} size={14} />
          </span>
          {task.due_date && <DueLabel date={task.due_date} done={done} now={now} />}
          <TaskIndicators counts={counts} />
        </div>
        <MemberAvatar member={task.assignee_id ? members[task.assignee_id] : null} size="sm" className="shrink-0" tooltip={!overlay} />
      </div>
    </div>
  );
}

function SortableCard({ task, counts, starred }: { task: Task; counts: TaskCounts; starred: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <TaskContextMenu task={task}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        onClick={() => ui.openTask(task.id)}
        className={cn("cursor-pointer touch-manipulation rounded-xl focus-ring", isDragging && "opacity-35")}
        {...attributes}
        {...listeners}
        aria-roledescription="carte de tâche"
      >
        <CardContent task={task} counts={counts} starred={starred} />
      </div>
    </TaskContextMenu>
  );
}

function ColumnAdd({ projectId, status, filters }: { projectId: ID; status: TaskStatus; filters: BoardFilters }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const submit = () => {
    const title = value.trim();
    if (!title) return;
    setValue("");
    const only = filters.assignees.length === 1 && filters.assignees[0] !== "none" ? filters.assignees[0] : null;
    void createTask({ project_id: projectId, title, status, assignee_id: only });
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-[13px] text-navy-400 transition-colors hover:bg-navy-900/[0.05] hover:text-navy-700 focus-ring"
      >
        <Plus className="size-4" /> Ajouter une tâche
      </button>
    );
  }
  return (
    <div className="rounded-xl bg-card p-2.5 shadow-card ring-2 ring-teal-500/30">
      <textarea
        autoFocus
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          submit();
          setOpen(false);
        }}
        placeholder="Titre de la tâche…"
        aria-label={`Nouvelle tâche (${STATUS_META[status].label})`}
        maxLength={500}
        className="block w-full resize-none bg-transparent text-[13px] leading-snug font-medium text-navy-900 outline-none placeholder:font-normal placeholder:text-navy-400"
      />
      <p className="mt-1 text-[11px] text-navy-400">Entrée pour créer · Échap pour annuler</p>
    </div>
  );
}

function Column({
  status,
  ids,
  board,
  projectId,
  filters,
  counts,
  starred,
}: {
  status: TaskStatus;
  ids: ID[];
  board: Board;
  projectId: ID;
  filters: BoardFilters;
  counts: (id: ID) => TaskCounts;
  starred: Set<ID>;
}) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const dragging = !!board.activeTask;
  return (
    <section
      ref={setNodeRef}
      aria-label={meta.label}
      className={cn(
        "flex max-h-full w-[272px] shrink-0 snap-start flex-col rounded-xl bg-white/30 shadow-[inset_0_1px_0_rgb(255_255_255/0.55)] transition-colors duration-200 xl:w-auto xl:min-w-[208px] xl:flex-1",
        isOver && dragging && "bg-teal-500/[0.08] ring-2 ring-teal-500/30",
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 px-3.5">
        <StatusIcon status={status} />
        <h3 className="text-[13px] font-semibold text-navy-900">{meta.label}</h3>
        <CountBadge>{ids.length}</CountBadge>
        {status === "done" && ids.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Actions de la colonne"
                className="ml-auto flex size-7 items-center justify-center rounded-md text-navy-400 hover:bg-navy-900/[0.06] hover:text-navy-800 focus-ring"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onSelect={async () => {
                  const n = await archiveDone(projectId);
                  toast.success(plural(n, "tâche archivée", "tâches archivées"));
                }}
              >
                <Archive /> Archiver les tâches terminées
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const task = board.byId.get(id);
            if (!task) return null;
            return <SortableCard key={id} task={task} counts={counts(id)} starred={starred.has(id)} />;
          })}
        </SortableContext>
        {ids.length === 0 && (
          <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-navy-900/10 text-xs text-navy-400">
            {dragging ? "Déposer ici" : "Aucune tâche"}
          </div>
        )}
        {status !== "done" && <ColumnAdd projectId={projectId} status={status} filters={filters} />}
      </div>
    </section>
  );
}

/** Linear-style board: one column per status, cards move by drag & drop. */
export function Kanban({
  board,
  projectId,
  filters,
  counts,
  starred,
}: {
  board: Board;
  projectId: ID;
  filters: BoardFilters;
  counts: (id: ID) => TaskCounts;
  starred: Set<ID>;
}) {
  return (
    <DndContext {...board.dnd}>
      <div className="-mx-4 flex h-full snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:snap-none">
        {board.visibleStatuses.map((status) => (
          <Column
            key={status}
            status={status}
            ids={board.columns[status]}
            board={board}
            projectId={projectId}
            filters={filters}
            counts={counts}
            starred={starred}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {board.activeTask && (
          <CardContent
            task={board.activeTask}
            counts={counts(board.activeTask.id)}
            starred={starred.has(board.activeTask.id)}
            overlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
