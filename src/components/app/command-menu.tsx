"use client";

import { CalendarCheck2, CircleCheckBig, LayoutGrid, MessagesSquare, Plus, Users, Workflow } from "@/components/kit/icons";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { Kbd } from "@/components/kit/pills";
import { ProjectIcon } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { CHAT_PATH } from "@/lib/chat";
import { useAllTasks, useMembersMap, useProjects, useProjectsMap } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";

/** ⌘K — jump anywhere, find any task, create one. */
export function CommandMenu() {
  const open = useApp((s) => s.commandOpen);
  const router = useRouter();
  const projects = useProjects();
  const projectsMap = useProjectsMap();
  const members = useMembersMap();
  const tasks = useAllTasks();

  const searchable = useMemo(
    () =>
      tasks
        .filter((t) => !t.archived_at)
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .slice(0, 400),
    [tasks],
  );

  const run = (fn: () => void) => {
    ui.setCommandOpen(false);
    fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={ui.setCommandOpen}
      title="Recherche"
      description="Rechercher une tâche, une page ou une action"
      className="top-[18%] sm:max-w-xl"
    >
      {/* cmdk needs its <Command> root: the dialog only provides the frame. */}
      <Command>
      <CommandInput placeholder="Rechercher une tâche, une page, une action…" />
      <CommandList className="max-h-[min(60vh,420px)]">
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem value="nouvelle tâche créer ajouter" onSelect={() => run(() => ui.openQuickAdd())}>
            <Plus /> Nouvelle tâche
            <CommandShortcut>
              <Kbd>C</Kbd>
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Aller à">
          <CommandItem value="dashboard accueil vue d'ensemble" onSelect={() => run(() => router.push("/"))}>
            <LayoutGrid /> Dashboard
          </CommandItem>
          <CommandItem value="mes tâches" onSelect={() => run(() => router.push("/mes-taches"))}>
            <CircleCheckBig /> Mes tâches
          </CommandItem>
          <CommandItem value="meeting hebdomadaire mercredi réunion rencontre" onSelect={() => run(() => router.push("/meeting"))}>
            <CalendarCheck2 /> Meeting hebdomadaire
          </CommandItem>
          <CommandItem value="messages chat clavardage discussion général" onSelect={() => run(() => router.push(CHAT_PATH))}>
            <MessagesSquare /> Messages
          </CommandItem>
          {projects.map((p) => (
            <CommandItem
              key={p.id}
              value={`projet ${p.name}`}
              onSelect={() => run(() => router.push(`/projets/${p.slug}`))}
            >
              <ProjectIcon project={p} size="xs" /> {p.name}
            </CommandItem>
          ))}
          <CommandItem value="workflows processus canevas" onSelect={() => run(() => router.push("/workflows"))}>
            <Workflow /> Workflows
          </CommandItem>
          <CommandItem value="équipe membres" onSelect={() => run(() => router.push("/equipe"))}>
            <Users /> Équipe
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Tâches">
          {searchable.map((t) => (
            <CommandItem
              key={t.id}
              value={`${t.title} ${projectsMap[t.project_id]?.name ?? ""} ${t.id}`}
              onSelect={() => run(() => ui.openTask(t.id))}
            >
              <StatusIcon status={t.status} />
              <span className="truncate">{t.title}</span>
              <span className="ml-auto flex shrink-0 items-center gap-2 pl-3 text-xs text-muted-foreground">
                {projectsMap[t.project_id]?.name}
                <MemberAvatar member={t.assignee_id ? members[t.assignee_id] : null} size="xs" />
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
