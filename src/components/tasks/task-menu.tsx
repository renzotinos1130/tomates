"use client";

import { Archive, ArchiveRestore, Check, Copy, PanelRight, Star, Trash2 } from "lucide-react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { PriorityIcon } from "@/components/kit/priority-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import { useEditablePriorityIds, useMembers } from "@/lib/hooks";
import {
  archiveTask,
  deleteTask,
  duplicateTask,
  setStatus,
  setWeekPriority,
  ui,
  updateTask,
} from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONTEXT = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};
const DROPDOWN = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const Tick = ({ on }: { on: boolean }) => (
  <Check className={cn("ml-auto size-3.5 text-navy-900", on ? "opacity-100" : "opacity-0")} />
);

export function confirmDeleteTask(task: Task) {
  ui.confirm({
    title: "Supprimer cette tâche ?",
    description: `« ${task.title} » sera supprimée définitivement, avec ses sous-tâches et ses commentaires. Pour la conserver dans l'historique, archivez-la plutôt.`,
    confirmLabel: "Supprimer",
    destructive: true,
    onConfirm: () => deleteTask(task.id),
  });
}

/** Menu body shared by the right-click menu and the "⋯" button. */
function TaskMenuItems({ task, kit, withOpen = true }: { task: Task; kit: typeof CONTEXT | typeof DROPDOWN; withOpen?: boolean }) {
  const { Item, Separator, Sub, SubTrigger, SubContent } = kit;
  const members = useMembers();
  const starred = useEditablePriorityIds().has(task.id);
  return (
    <>
      {withOpen && (
        <>
          <Item onSelect={() => ui.openTask(task.id)}>
            <PanelRight /> Ouvrir
          </Item>
          <Separator />
        </>
      )}
      <Sub>
        <SubTrigger className="gap-2">
          <StatusIcon status={task.status} /> Statut
        </SubTrigger>
        <SubContent className="w-44">
          {STATUSES.map((s) => (
            <Item key={s} onSelect={() => void setStatus(task.id, s)} className="gap-2">
              <StatusIcon status={s} /> {STATUS_META[s].label}
              <Tick on={task.status === s} />
            </Item>
          ))}
        </SubContent>
      </Sub>
      <Sub>
        <SubTrigger className="gap-2">
          <MemberAvatar member={members.find((m) => m.id === task.assignee_id) ?? null} size="xs" /> Responsable
        </SubTrigger>
        <SubContent className="w-52">
          {members.map((m) => (
            <Item key={m.id} onSelect={() => void updateTask(task.id, { assignee_id: m.id })} className="gap-2">
              <MemberAvatar member={m} size="xs" /> {m.full_name}
              <Tick on={task.assignee_id === m.id} />
            </Item>
          ))}
          <Separator />
          <Item onSelect={() => void updateTask(task.id, { assignee_id: null })} className="gap-2">
            <MemberAvatar member={null} size="xs" /> Non assignée
            <Tick on={!task.assignee_id} />
          </Item>
        </SubContent>
      </Sub>
      <Sub>
        <SubTrigger className="gap-2">
          <PriorityIcon priority={task.priority} /> Priorité
        </SubTrigger>
        <SubContent className="w-40">
          {PRIORITIES.map((p) => (
            <Item key={p} onSelect={() => void updateTask(task.id, { priority: p })} className="gap-2">
              <PriorityIcon priority={p} /> {PRIORITY_META[p].label}
              <Tick on={task.priority === p} />
            </Item>
          ))}
        </SubContent>
      </Sub>
      <Separator />
      <Item onSelect={() => void setWeekPriority(task.id, !starred)}>
        <Star className={cn(starred && "fill-sun-400 text-sun-500")} />
        {starred ? "Retirer des priorités de la semaine" : "Priorité de la semaine"}
      </Item>
      <Item onSelect={() => void duplicateTask(task.id)}>
        <Copy /> Dupliquer
      </Item>
      <Item onSelect={() => void archiveTask(task.id, !task.archived_at)}>
        {task.archived_at ? <ArchiveRestore /> : <Archive />}
        {task.archived_at ? "Restaurer" : "Archiver"}
      </Item>
      <Separator />
      <Item variant="destructive" onSelect={() => confirmDeleteTask(task)}>
        <Trash2 /> Supprimer
      </Item>
    </>
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function TaskContextMenu({ task, children }: { task: Task; children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60" onClick={stop}>
        <TaskMenuItems task={task} kit={CONTEXT} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TaskDropdownMenu({
  task,
  children,
  withOpen = true,
  align = "end",
}: {
  task: Task;
  children: React.ReactNode;
  withOpen?: boolean;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60" onClick={stop}>
        <TaskMenuItems task={task} kit={DROPDOWN} withOpen={withOpen} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
