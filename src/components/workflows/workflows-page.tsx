"use client";

import { Copy, MoreHorizontal, Pencil, Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { ProjectPicker } from "@/components/kit/pickers";
import { ProjectChip, ProjectIcon } from "@/components/kit/project-icon";
import { chipClass } from "@/components/tasks/draft-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { relativeTime } from "@/lib/dates";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import { createWorkflow, deleteWorkflow, duplicateWorkflow, ui, updateWorkflow, useApp } from "@/lib/store";
import type { ID, Workflow } from "@/lib/types";
import { firstName, plural } from "@/lib/utils";
import { WorkflowPreview } from "./workflow-preview";

function WorkflowForm({ workflow, onDone }: { workflow?: Workflow; onDone: () => void }) {
  const router = useRouter();
  const projects = useProjectsMap();
  const [name, setName] = useState(workflow?.name ?? "");
  const [projectId, setProjectId] = useState<ID | null>(workflow?.project_id ?? null);
  const [saving, setSaving] = useState(false);
  const project = projectId ? projects[projectId] : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    if (workflow) {
      await updateWorkflow(workflow.id, { name: name.trim(), project_id: projectId });
      onDone();
    } else {
      const created = await createWorkflow({ name, project_id: projectId });
      if (created) {
        onDone();
        router.push(`/workflows/${created.id}`);
      }
    }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{workflow ? "Modifier le workflow" : "Nouveau workflow"}</DialogTitle>
        <DialogDescription>
          Un canevas pour dessiner un processus de l&apos;équipe : ce qui le déclenche, les étapes, qui valide, ce qui
          est livré.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="workflow-name">Nom</Label>
        <Input
          id="workflow-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Publication d'un article"
          autoFocus
          maxLength={120}
        />
      </div>
      <div className="grid gap-2">
        <Label>Projet (facultatif)</Label>
        <div className="flex items-center gap-2">
          <ProjectPicker value={projectId ?? ""} onChange={(id) => setProjectId(id)}>
            <button type="button" className={chipClass}>
              {project ? (
                <>
                  <ProjectIcon project={project} size="xs" className="-ml-0.5" />
                  {project.name}
                </>
              ) : (
                "Choisir un projet"
              )}
            </button>
          </ProjectPicker>
          {projectId && (
            <button
              type="button"
              onClick={() => setProjectId(null)}
              className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-navy-900 focus-ring"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant={workflow ? "default" : "tomato"} disabled={!name.trim() || saving}>
          {workflow ? "Enregistrer" : "Créer le workflow"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WorkflowDialog({
  open,
  onOpenChange,
  workflow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow?: Workflow;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <WorkflowForm workflow={workflow} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function confirmDeleteWorkflow(workflow: Workflow, after?: () => void) {
  ui.confirm({
    title: "Supprimer ce workflow ?",
    description: `« ${workflow.name} » sera supprimé définitivement pour toute l'équipe.`,
    confirmLabel: "Supprimer",
    destructive: true,
    onConfirm: async () => {
      await deleteWorkflow(workflow.id);
      after?.();
    },
  });
}

function WorkflowCard({ workflow, index }: { workflow: Workflow; index: number }) {
  const now = useNow();
  const members = useMembersMap();
  const projects = useProjectsMap();
  const [editing, setEditing] = useState(false);
  const editor = workflow.updated_by ? members[workflow.updated_by] : null;
  const project = workflow.project_id ? projects[workflow.project_id] : undefined;

  return (
    <article
      className="card-surface card-interactive gw-reveal relative flex flex-col overflow-hidden"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="relative h-36 border-b border-navy-900/[0.06] bg-white/45">
        <WorkflowPreview doc={workflow.graph} className="absolute inset-0 size-full p-3" />
      </div>
      <div className="flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14.5px] font-semibold text-navy-900">
            <Link
              href={`/workflows/${workflow.id}`}
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-teal-500/50"
            >
              {workflow.name}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {project && <ProjectChip project={project} />}
            <span>
              {plural(workflow.graph.nodes.length, "étape")} · {plural(workflow.graph.edges.length, "connexion")}
            </span>
          </p>
          <p className="mt-1.5 text-[11.5px] text-navy-400">
            Modifié {editor ? `par ${firstName(editor.full_name)} ` : ""}
            {relativeTime(workflow.updated_at, now)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions pour ${workflow.name}`}
              className="relative z-10 -mt-1 -mr-1.5 flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-white/60 hover:text-navy-800 focus-ring"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Renommer ou lier
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void duplicateWorkflow(workflow.id)}>
              <Copy /> Dupliquer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => confirmDeleteWorkflow(workflow)}>
              <Trash2 /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <WorkflowDialog open={editing} onOpenChange={setEditing} workflow={workflow} />
    </article>
  );
}

/** All the team's workflows, most recently edited first. */
export function WorkflowsPage() {
  const all = useApp((s) => s.workflows);
  const [creating, setCreating] = useState(false);
  const list = useMemo(
    () => Object.values(all).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    [all],
  );
  return (
    <>
      <PageHeader
        title="Workflows"
        subtitle={list.length ? plural(list.length, "canevas", "canevas") : "Les processus de l'équipe, dessinés"}
        actions={
          <Button variant="tomato" onClick={() => setCreating(true)}>
            <Plus /> <span className="hidden sm:inline">Nouveau workflow</span>
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-16 sm:px-6 lg:px-8">
        {list.length === 0 ? (
          <div className="card-surface">
            <EmptyState
              className="py-16"
              icon={<WorkflowIcon className="size-4" />}
              title="Aucun workflow pour l'instant"
              hint="Dessinez un processus de l'équipe : ce qui le déclenche, les étapes, qui valide et ce qui est livré."
              action={
                <Button variant="tomato" onClick={() => setCreating(true)}>
                  <Plus /> Créer un workflow
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {list.map((w, i) => (
              <WorkflowCard key={w.id} workflow={w} index={i} />
            ))}
          </div>
        )}
      </main>
      <WorkflowDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
