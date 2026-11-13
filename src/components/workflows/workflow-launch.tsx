"use client";

import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { AssigneePicker, OptionalProjectPicker } from "@/components/kit/pickers";
import { ProjectChip, ProjectIcon } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_META } from "@/lib/constants";
import { useMembersMap, useProjectsMap } from "@/lib/hooks";
import { launchWorkflow, ui, useApp } from "@/lib/store";
import type { ID, Workflow, WorkflowDoc, WorkflowStep } from "@/lib/types";
import { cn, firstName, plural } from "@/lib/utils";
import { launchTitle, planLaunch } from "@/lib/workflow-run";

/**
 * The foot of a step on the canvas: the project its work belongs to and whose
 * it is, both chosen right here with a click, and, once the workflow has been
 * launched, the task made from it (the latest one), which opens from here.
 */
export function StepFoot({
  workflowId,
  step,
  data,
  update,
}: {
  workflowId: ID;
  step: string;
  data: WorkflowStep;
  update: (patch: { project_id?: ID | null; assignee_id?: ID | null }) => void;
}) {
  const projects = useProjectsMap();
  const members = useMembersMap();
  const tasks = useApp((s) => s.tasks);
  const task = useMemo(() => {
    let latest = null;
    for (const t of Object.values(tasks)) {
      if (t.workflow_id !== workflowId || t.workflow_step !== step) continue;
      if (!latest || t.created_at > latest.created_at) latest = t;
    }
    return latest;
  }, [tasks, workflowId, step]);
  // A project since archived, a person who left: the step is to be placed and given again.
  const project = data.project_id && !projects[data.project_id]?.archived_at ? projects[data.project_id] : undefined;
  const person = data.assignee_id && members[data.assignee_id]?.active ? members[data.assignee_id] : undefined;
  // What starts a process is not work to hand out.
  if (data.kind === "trigger") return null;
  return (
    <>
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <OptionalProjectPicker value={project?.id ?? null} onChange={(id) => update({ project_id: id })}>
          <button
            type="button"
            data-empty={project ? undefined : ""}
            aria-label={project ? `Projet de « ${data.label} » : ${project.name}. Changer` : `Choisir le projet de « ${data.label} »`}
            title={project ? `${project.name} · changer le projet` : "Choisir le projet"}
          >
            {project ? (
              <>
                <ProjectIcon project={project} size="xs" className="size-3.5" />
                <span className="truncate">{project.name}</span>
              </>
            ) : (
              "Sans projet"
            )}
          </button>
        </OptionalProjectPicker>
        <AssigneePicker value={person?.id ?? null} onChange={(id) => update({ assignee_id: id })} align="end">
          <button
            type="button"
            className="shrink-0"
            data-empty={person ? undefined : ""}
            aria-label={person ? `Responsable de « ${data.label} » : ${person.full_name}. Changer` : `Choisir le responsable de « ${data.label} »`}
            title={person ? `${person.full_name} · changer le responsable` : "Choisir le responsable"}
          >
            {person ? (
              <>
                <MemberAvatar member={person} size="xs" className="-my-px size-[18px]" />
                {firstName(person.full_name)}
              </>
            ) : (
              "À assigner"
            )}
          </button>
        </AssigneePicker>
      </div>
      {task && (
        <button
          type="button"
          onClick={() => ui.openTask(task.id)}
          title={`Ouvrir la tâche « ${task.title} »`}
          className={cn("min-w-0 transition-colors", STATUS_META[task.status].text)}
        >
          <StatusIcon status={task.status} size={12} />
          <span className="truncate">Tâche : {STATUS_META[task.status].label.toLowerCase()}</span>
        </button>
      )}
    </>
  );
}

function LaunchForm({ workflow, doc, onDone }: { workflow: Workflow; doc: WorkflowDoc; onDone: () => void }) {
  const id = useId();
  const projects = useProjectsMap();
  const members = useMembersMap();
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = useMemo(() => planLaunch(doc, projects, members), [doc, projects, members]);
  const unplaced = plan.skipped.filter((s) => s.reason === "no-project");
  const count = plan.tasks.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || count === 0) return;
    setBusy(true);
    const created = await launchWorkflow(workflow.id, doc, about);
    setBusy(false);
    if (created === 0) return;
    toast.success(created === count ? `${plural(created, "tâche créée", "tâches créées")} à partir de « ${workflow.name} ».` : `${created} tâches créées sur ${count}.`);
    onDone();
  };

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Créer les tâches de « {workflow.name} »</DialogTitle>
        <DialogDescription>
          Chaque étape qui a un projet devient une tâche dans ce projet, pour la personne choisie, dans l&apos;ordre du dessin. Rien d&apos;autre
          ne se déclenche : c&apos;est l&apos;équipe qui fait le travail.
        </DialogDescription>
      </DialogHeader>

      {count > 0 ? (
        <ol className="grid max-h-[40vh] gap-1 overflow-y-auto" aria-label="Tâches qui seront créées">
          {plan.tasks.map((t, i) => {
            const person = t.assignee_id ? members[t.assignee_id] : undefined;
            return (
              <li key={t.step} className="flex min-w-0 items-center gap-3 rounded-xl bg-navy-900/[0.035] px-3 py-2">
                <span className="w-4 shrink-0 text-center text-xs font-semibold text-navy-500 tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-navy-900">{launchTitle(t.label, about)}</span>
                  <ProjectChip project={projects[t.project_id]} />
                </span>
                {person ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-navy-700">
                    <MemberAvatar member={person} size="xs" />
                    {firstName(person.full_name)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-navy-500">Non assignée</span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-navy-900/[0.035] px-3.5 py-3 text-[13px] leading-relaxed text-navy-800">
          Aucune étape n&apos;a encore de projet. Sur une étape, cliquez « Sans projet » pour la placer, puis « À assigner » pour la donner à
          quelqu&apos;un.
        </p>
      )}

      {unplaced.length > 0 && count > 0 && (
        <p className="-mt-2 text-xs leading-relaxed text-navy-600" role="note">
          Sans projet, donc sans tâche : {unplaced.map((s) => `« ${s.label} »`).join(", ")}.
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor={id}>Pour quoi ? (facultatif)</Label>
        <Input
          id={id}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={80}
          placeholder="Infolettre de décembre, version 2.1…"
          autoComplete="off"
          className="bg-card"
        />
        <p className="text-xs leading-relaxed text-navy-600">Ajouté au nom de chaque tâche : utile quand le même workflow sert plusieurs fois.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy || count === 0}>
          {busy ? "Création…" : count > 0 ? `Créer ${plural(count, "tâche")}` : "Créer les tâches"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** What launching a workflow will create, before it is created. */
export function LaunchDialog({ workflow, doc, onOpenChange }: { workflow: Workflow; doc: WorkflowDoc | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">{doc && <LaunchForm workflow={workflow} doc={doc} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}
