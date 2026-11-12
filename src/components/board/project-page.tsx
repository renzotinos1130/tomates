"use client";

import { Archive, FolderSearch, MoreHorizontal, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ProjectDialog } from "@/components/app/project-dialog";
import { EmptyState } from "@/components/kit/empty-state";
import { ProjectIcon } from "@/components/kit/project-icon";
import { useTaskCounts } from "@/components/tasks/use-task-counts";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { todayDateOnly } from "@/lib/dates";
import { useEditablePriorityIds, useLocalState, useMe, useNow } from "@/lib/hooks";
import { projectStats, type SortKey } from "@/lib/selectors";
import { archiveDone, ui, updateProject, useApp } from "@/lib/store";
import { nowIso, plural } from "@/lib/utils";
import { BoardToolbar, type BoardView } from "./board-toolbar";
import { Kanban } from "./kanban";
import { TaskTable } from "./task-table";
import { activeFilterCount, EMPTY_FILTERS, useBoard, type BoardFilters } from "./use-board";

export function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const now = useNow();
  const me = useMe();
  const projects = useApp((s) => s.projects);
  const allTasks = useApp((s) => s.tasks);
  const project = useMemo(() => Object.values(projects).find((p) => p.slug === slug) ?? null, [projects, slug]);
  const tasks = useMemo(
    () => (project ? Object.values(allTasks).filter((t) => t.project_id === project.id) : []),
    [allTasks, project],
  );

  const [view, setView] = useLocalState<BoardView>("tthq:view", "table");
  const [sort, setSort] = useLocalState<SortKey>("tthq:sort", "manual");
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [editOpen, setEditOpen] = useState(false);

  const board = useBoard(tasks, filters, sort);
  const counts = useTaskCounts();
  const starred = useEditablePriorityIds();
  const stats = useMemo(
    () => (project ? projectStats(tasks, project.id, todayDateOnly(now)) : null),
    [tasks, project, now],
  );

  if (!project || project.archived_at) {
    return (
      <>
        <PageHeader title="Projet introuvable" />
        <EmptyState
          className="py-24"
          icon={<FolderSearch className="size-4" />}
          title={project ? "Ce projet est archivé" : "Ce projet n'existe pas"}
          hint="Il a peut-être été renommé ou archivé par un membre de l'équipe."
          action={
            <div className="flex gap-2">
              {project?.archived_at && (
                <Button variant="outline" onClick={() => void updateProject(project.id, { archived_at: null })}>
                  Restaurer le projet
                </Button>
              )}
              <Button asChild>
                <Link href="/">Retour au dashboard</Link>
              </Button>
            </div>
          }
        />
      </>
    );
  }

  const visibleCount = board.visibleStatuses.reduce((n, s) => n + board.columns[s].length, 0);
  const filtered = activeFilterCount(filters) > 0;

  return (
    <div className={view === "kanban" ? "flex h-full flex-col" : undefined}>
      <PageHeader
        icon={<ProjectIcon project={project} size="sm" />}
        title={project.name}
        subtitle={
          stats && (
            <>
              {plural(stats.open, "tâche ouverte", "tâches ouvertes")} · {stats.progress} % complété
            </>
          )
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Options du projet">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Modifier le projet
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    const n = await archiveDone(project.id);
                    toast.success(n ? plural(n, "tâche archivée", "tâches archivées") : "Aucune tâche terminée à archiver");
                  }}
                >
                  <Archive /> Archiver les tâches terminées
                </DropdownMenuItem>
                {me?.role === "admin" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        ui.confirm({
                          title: `Archiver « ${project.name} » ?`,
                          description:
                            "Le projet et ses tâches disparaîtront de la navigation et des vues d'ensemble. Rien n'est supprimé : il pourra être restauré.",
                          confirmLabel: "Archiver le projet",
                          destructive: true,
                          onConfirm: async () => {
                            await updateProject(project.id, { archived_at: nowIso() });
                            router.push("/");
                          },
                        })
                      }
                    >
                      <Archive /> Archiver le projet
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="tomato"
              size="icon"
              aria-label="Nouvelle tâche"
              className="lg:hidden"
              onClick={() => ui.openQuickAdd({ project_id: project.id })}
            >
              <Plus />
            </Button>
          </>
        }
      >
        <BoardToolbar
          view={view}
          onViewChange={setView}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
        />
      </PageHeader>

      <main className={view === "kanban" ? "min-h-0 flex-1 px-4 pt-5 sm:px-6 lg:px-8" : "px-4 pt-5 pb-24 sm:px-6 lg:px-8"}>
        {filtered && visibleCount === 0 && !filters.showArchived ? (
          <EmptyState
            className="py-20"
            icon={<FolderSearch className="size-4" />}
            title="Aucune tâche ne correspond aux filtres"
            action={
              <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                Réinitialiser les filtres
              </Button>
            }
          />
        ) : view === "kanban" ? (
          <Kanban board={board} projectId={project.id} filters={filters} counts={counts} starred={starred} />
        ) : (
          <div className="mx-auto max-w-[1180px]">
            <TaskTable board={board} projectId={project.id} filters={filters} counts={counts} starred={starred} />
          </div>
        )}
      </main>

      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
    </div>
  );
}
