"use client";

import { ArrowLeft, Copy, MoreHorizontal, Pencil, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { ProjectChip } from "@/components/kit/project-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProjectsMap } from "@/lib/hooks";
import { duplicateWorkflow, useApp } from "@/lib/store";
import { WorkflowCanvas } from "./workflow-canvas";
import { confirmDeleteWorkflow, WorkflowDialog } from "./workflows-page";

export function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const workflow = useApp((s) => s.workflows[id] ?? null);
  const projects = useProjectsMap();
  const [editing, setEditing] = useState(false);

  if (!workflow) {
    return (
      <>
        <PageHeader title="Workflow introuvable" />
        <EmptyState
          className="py-24"
          icon={<WorkflowIcon className="size-4" />}
          title="Ce workflow n'existe pas"
          hint="Il a peut-être été supprimé par un membre de l'équipe."
          action={
            <Button asChild variant="outline">
              <Link href="/workflows">Voir tous les workflows</Link>
            </Button>
          }
        />
      </>
    );
  }
  const project = workflow.project_id ? projects[workflow.project_id] : undefined;

  return (
    <>
      <PageHeader
        icon={
          <Button asChild variant="ghost" size="icon-sm" aria-label="Retour aux workflows">
            <Link href="/workflows">
              <ArrowLeft />
            </Link>
          </Button>
        }
        title={workflow.name}
        subtitle={project ? <ProjectChip project={project} className="text-[13px]" /> : "Workflow"}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Options du workflow">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Renommer ou lier
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  const copy = await duplicateWorkflow(workflow.id);
                  if (copy) router.push(`/workflows/${copy.id}`);
                }}
              >
                <Copy /> Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => confirmDeleteWorkflow(workflow, () => router.push("/workflows"))}
              >
                <Trash2 /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <main className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-16 sm:px-6 lg:px-8">
        <WorkflowCanvas workflow={workflow} />
      </main>
      <WorkflowDialog open={editing} onOpenChange={setEditing} workflow={workflow} />
    </>
  );
}
