"use client";

import { DndContext, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArchiveRestore, CalendarDays, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { AssigneePicker, DuePicker, PriorityPicker, StatusPicker } from "@/components/kit/pickers";
import { CountBadge, DueLabel, PriorityPill, PriorityStar, StatusLabel } from "@/components/kit/pills";
import { StatusIcon } from "@/components/kit/status-icon";
import { TaskCheck } from "@/components/kit/task-check";
import { TaskIndicators } from "@/components/tasks/task-line";
import { TaskContextMenu, TaskDropdownMenu } from "@/components/tasks/task-menu";
import type { TaskCounts } from "@/components/tasks/use-task-counts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/constants";
import { useMembersMap, useNow } from "@/lib/hooks";
import { archiveDone, archiveTask, createTask, setStatus, toggleDone, ui, updateTask } from "@/lib/store";
import type { ID, Task, TaskStatus } from "@/lib/types";
import { cn, firstName, plural } from "@/lib/utils";
import { columnId, type Board, type BoardFilters } from "./use-board";

const GRID =
  "grid items-center grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_168px_148px_120px_128px_40px]";

const cellButton =
  "flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-[13px] transition-colors hover:bg-navy-900/[0.05] focus-ring data-[state=open]:bg-navy-900/[0.05]";

interface RowProps {
  task: Task;
  counts: TaskCounts;
  starred: boolean;
  dragging?: boolean;
  overlay?: boolean;
  handle?: React.ReactNode;
}

/** One table line. Every cell edits in place; the title opens the detail panel. */
function RowContent({ task, counts, starred, overlay, handle }: RowProps) {
  const now = useNow();
  const members = useMembersMap();
  const assignee = task.assignee_id ? members[task.assignee_id] : null;
  const done = task.status === "done";
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const v = inputRef.current?.value.trim();
    if (v && v !== task.title) void updateTask(task.id, { title: v });
    setEditing(false);
  };

  return (
    <div
      className={cn(
        GRID,
        "group/row relative min-h-11 gap-x-1 pr-2 pl-1.5 transition-colors",
        overlay ? "rounded-xl bg-card shadow-drag" : "hover:bg-white/40",
      )}
    >
      {/* Tâche */}
      <div className="flex min-w-0 items-center gap-2 py-1">
        {handle ?? <span className="hidden w-5 shrink-0 md:block" />}
        <TaskCheck done={done} onToggle={() => void toggleDone(task.id)} />
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            defaultValue={task.title}
            onClick={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Titre de la tâche"
            maxLength={500}
            className="h-8 min-w-0 flex-1 rounded-lg border border-teal-500/60 bg-card px-2 text-[13px] font-medium text-navy-900 ring-3 ring-teal-500/15 outline-none"
          />
        ) : (
          <>
            <span
              data-task-title
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className={cn(
                "line-clamp-2 min-w-0 py-1.5 text-[13px] leading-snug md:line-clamp-1",
                done ? "text-navy-400 line-through decoration-navy-200" : "font-medium text-navy-900",
              )}
            >
              {task.title}
            </span>
            {starred && <PriorityStar active className="size-3.5 shrink-0" />}
            <TaskIndicators counts={counts} className="hidden lg:flex" />
            {!overlay && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Renommer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(true);
                    }}
                    className="hidden size-6 shrink-0 items-center justify-center rounded-md text-navy-300 opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-navy-900/[0.06] hover:text-navy-700 focus-visible:opacity-100 md:flex focus-ring"
                  >
                    <Pencil className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Renommer (double-clic)</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Responsable */}
      <div className="order-last md:order-none">
        <AssigneePicker value={task.assignee_id} onChange={(assignee_id) => void updateTask(task.id, { assignee_id })}>
          <button type="button" aria-label="Responsable" className={cn(cellButton, "w-auto md:w-full")}>
            <MemberAvatar member={assignee} size="sm" />
            <span className={cn("hidden truncate md:inline", assignee ? "text-navy-800" : "text-navy-400")}>
              {assignee ? firstName(assignee.full_name) : "Assigner"}
            </span>
          </button>
        </AssigneePicker>
      </div>

      {/* Statut */}
      <div>
        <StatusPicker value={task.status} onChange={(s) => void setStatus(task.id, s)}>
          <button type="button" aria-label="Statut" className={cn(cellButton, "w-auto md:w-full")}>
            <span className="md:hidden">
              <StatusIcon status={task.status} />
            </span>
            <span className="hidden md:inline-flex">
              <StatusLabel status={task.status} />
            </span>
          </button>
        </StatusPicker>
      </div>

      {/* Priorité */}
      <div className="hidden md:block">
        <PriorityPicker value={task.priority} onChange={(priority) => void updateTask(task.id, { priority })}>
          <button type="button" aria-label="Priorité" className={cellButton}>
            <PriorityPill priority={task.priority} className="font-normal" />
          </button>
        </PriorityPicker>
      </div>

      {/* Échéance */}
      <div className="hidden md:block">
        <DuePicker value={task.due_date} onChange={(due_date) => void updateTask(task.id, { due_date })}>
          <button type="button" aria-label="Échéance" className={cellButton}>
            {task.due_date ? (
              <DueLabel date={task.due_date} done={done} now={now} />
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-navy-400 opacity-0 transition-opacity group-hover/row:opacity-100">
                <CalendarDays className="size-3.5" /> Ajouter
              </span>
            )}
          </button>
        </DuePicker>
      </div>

      {/* Actions */}
      <div className="hidden justify-end md:flex">
        {!overlay && (
          <TaskDropdownMenu task={task}>
            <button
              type="button"
              aria-label="Actions"
              className="flex size-7 items-center justify-center rounded-md text-navy-400 opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-navy-900/[0.06] hover:text-navy-800 focus-visible:opacity-100 data-[state=open]:opacity-100 focus-ring"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </TaskDropdownMenu>
        )}
      </div>
    </div>
  );
}

function SortableRow(props: RowProps) {
  const { task } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <TaskContextMenu task={task}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        onClick={() => ui.openTask(task.id)}
        className={cn(
          "cursor-pointer border-t border-navy-900/[0.05] first:border-t-0",
          isDragging && "relative z-10 opacity-40",
        )}
      >
        <RowContent
          {...props}
          handle={
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label="Réorganiser"
              onClick={(e) => e.stopPropagation()}
              className="hidden h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-navy-300 opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-navy-600 focus-visible:opacity-100 active:cursor-grabbing md:flex focus-ring"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          }
        />
      </div>
    </TaskContextMenu>
  );
}

/** "+ Ajouter une tâche" line at the bottom of each group: type, Enter, repeat. */
function InlineAdd({ projectId, status, filters }: { projectId: ID; status: TaskStatus; filters: BoardFilters }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const title = value.trim();
    if (!title) return;
    setValue("");
    const only = filters.assignees.length === 1 && filters.assignees[0] !== "none" ? filters.assignees[0] : null;
    void createTask({
      project_id: projectId,
      title,
      status,
      assignee_id: only,
      priority: filters.priorities.length === 1 ? filters.priorities[0] : "normal",
    });
  };
  return (
    <div className="flex h-10 items-center gap-2 border-t border-navy-900/[0.05] pr-3 pl-1.5">
      <span className="hidden w-5 shrink-0 md:block" />
      <Plus className="size-[18px] shrink-0 text-navy-300" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setValue("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Ajouter une tâche"
        aria-label={`Ajouter une tâche (${STATUS_META[status].label})`}
        maxLength={500}
        className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-navy-900 outline-none placeholder:text-navy-400"
      />
      {value.trim() && <span className="hidden text-[11px] text-navy-400 sm:inline">Entrée pour créer</span>}
    </div>
  );
}

function Group({
  status,
  ids,
  board,
  projectId,
  filters,
  counts,
  starred,
  collapsed,
  onToggle,
}: {
  status: TaskStatus;
  ids: ID[];
  board: Board;
  projectId: ID;
  filters: BoardFilters;
  counts: (id: ID) => TaskCounts;
  starred: Set<ID>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const dragging = !!board.activeTask;

  return (
    <section ref={setNodeRef} aria-label={meta.label}>
      <div className="flex h-9 items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="-ml-1 flex h-7 items-center gap-2 rounded-lg pr-2.5 pl-1 text-[13px] font-semibold text-navy-900 transition-colors hover:bg-navy-900/[0.05] focus-ring"
        >
          <ChevronRight className={cn("size-3.5 text-navy-400 transition-transform duration-200", !collapsed && "rotate-90")} />
          <StatusIcon status={status} />
          {meta.label}
          <CountBadge>{ids.length}</CountBadge>
        </button>
        {status === "done" && ids.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Actions du groupe"
                className="flex size-7 items-center justify-center rounded-md text-navy-400 hover:bg-navy-900/[0.06] hover:text-navy-800 focus-ring"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onSelect={async () => {
                  const n = await archiveDone(projectId);
                  toast.success(`${plural(n, "tâche archivée", "tâches archivées")}`, {
                    description: "Elles restent consultables via « Archivées ».",
                  });
                }}
              >
                <Archive /> Archiver les tâches terminées
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        className={cn(
          "card-surface relative overflow-hidden rounded-xl transition-shadow duration-200",
          isOver && dragging && "ring-2 ring-teal-500/40",
          collapsed && !(isOver && dragging) && "hidden",
        )}
      >
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 z-[1] w-[3px]", meta.accent)} />
        {collapsed ? (
          <div className="px-4 py-3 text-xs text-muted-foreground">Déposer ici pour passer à « {meta.label} »</div>
        ) : (
          <>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {ids.map((id) => {
                const task = board.byId.get(id);
                if (!task) return null;
                return <SortableRow key={id} task={task} counts={counts(id)} starred={starred.has(id)} />;
              })}
            </SortableContext>
            {ids.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                {dragging ? "Déposer ici" : `Aucune tâche « ${meta.label.toLowerCase()} ».`}
              </div>
            )}
            {status !== "done" && <InlineAdd projectId={projectId} status={status} filters={filters} />}
          </>
        )}
      </div>
    </section>
  );
}

/** Monday-style structured table, grouped by status. */
export function TaskTable({
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
  const [collapsed, setCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>({ done: true });
  const now = useNow();
  const members = useMembersMap();

  return (
    <div className="space-y-4">
      {/* Column headers */}
      <div className={cn(GRID, "hidden gap-x-1 pr-2 pl-1.5 text-xs font-medium text-navy-400 md:grid")}>
        <span className="pl-[54px]">Tâche</span>
        <span className="px-2">Responsable</span>
        <span className="px-2">Statut</span>
        <span className="px-2">Priorité</span>
        <span className="px-2">Échéance</span>
        <span />
      </div>

      <DndContext {...board.dnd}>
        {board.visibleStatuses.map((status) => (
          <Group
            key={status}
            status={status}
            ids={board.columns[status]}
            board={board}
            projectId={projectId}
            filters={filters}
            counts={counts}
            starred={starred}
            collapsed={!!collapsed[status]}
            onToggle={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
          />
        ))}
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {board.activeTask && (
            <RowContent
              task={board.activeTask}
              counts={counts(board.activeTask.id)}
              starred={starred.has(board.activeTask.id)}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {filters.showArchived && (
        <section aria-label="Archivées">
          <div className="flex h-9 items-center gap-2 text-[13px] font-semibold text-navy-900">
            <Archive className="size-4 text-navy-400" /> Archivées <CountBadge>{board.archived.length}</CountBadge>
          </div>
          <div className="card-surface overflow-hidden rounded-xl">
            {board.archived.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground">Aucune tâche archivée.</div>
            )}
            {board.archived.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => ui.openTask(t.id)}
                onKeyDown={(e) => e.key === "Enter" && ui.openTask(t.id)}
                className="group/row flex min-h-11 cursor-pointer items-center gap-3 border-t border-navy-900/[0.05] px-4 first:border-t-0 hover:bg-navy-900/[0.022] focus-ring"
              >
                <StatusIcon status={t.status} className="opacity-60" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-navy-500">{t.title}</span>
                <DueLabel date={t.due_date} done now={now} className="hidden sm:inline-flex" />
                <MemberAvatar member={t.assignee_id ? members[t.assignee_id] : null} size="sm" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void archiveTask(t.id, false);
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-navy-600 opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-navy-900/[0.06] focus-visible:opacity-100 focus-ring"
                >
                  <ArchiveRestore className="size-3.5" /> Restaurer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
