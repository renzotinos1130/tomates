"use client";

import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Hourglass, UserPlus } from "@/components/kit/icons";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { AssigneePicker, DuePicker, OptionalProjectPicker } from "@/components/kit/pickers";
import { ProjectChip, ProjectIcon } from "@/components/kit/project-icon";
import { StatusIcon } from "@/components/kit/status-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_META } from "@/lib/constants";
import { formatLongDate, formatShortDate, parseDateOnly } from "@/lib/dates";
import { useMembersMap, useProjectsMap } from "@/lib/hooks";
import { launchWorkflow, ui, useApp } from "@/lib/store";
import type { DateOnly, ID, Workflow, WorkflowDoc, WorkflowStep } from "@/lib/types";
import { cn, firstName, plural } from "@/lib/utils";
import { isDateOnly, launchTitle, planLaunch } from "@/lib/workflow-run";
import { AssigneeFaces } from "@/components/kit/assignee-faces";
import { assigneesOf } from "@/lib/task-logic";
import { listed } from "@/lib/activity";

/**
 * The foot of a step on the canvas, on one line: the project its work belongs
 * to, the day it is due and whose it is, each chosen right here with a click.
 * Once the workflow has been launched, the task made from the step (the latest
 * one) shows under it, and opens from here.
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
  update: (patch: { project_id?: ID | null; assignee_ids?: ID[]; assignee_id?: ID | null; due_date?: DateOnly | null }) => void;
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
  const people = assigneesOf(data).filter((id) => members[id]?.active);
  const names = listed(people.map((id) => members[id].full_name));
  const due = isDateOnly(data.due_date) ? data.due_date : null;
  // What starts a process is not work to hand out.
  if (data.kind === "trigger") return null;
  return (
    <>
      {/* One line, so a step keeps its height: where the work goes, when it is due, whose it is. */}
      <div className="flex min-w-0 items-center gap-1">
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
        <DuePicker value={due} onChange={(day) => update({ due_date: day })} align="end">
          <button
            type="button"
            className="ml-auto shrink-0"
            data-empty={due ? undefined : ""}
            data-icon={due ? undefined : ""}
            aria-label={due ? `Échéance de « ${data.label} » : ${formatLongDate(parseDateOnly(due)).toLowerCase()}. Changer` : `Choisir l'échéance de « ${data.label} »`}
            title={due ? `${formatLongDate(parseDateOnly(due))} · changer l'échéance` : "Choisir l'échéance"}
          >
            {due ? formatShortDate(parseDateOnly(due)) : <CalendarDays className="size-3.5" aria-hidden="true" />}
          </button>
        </DuePicker>
        <AssigneePicker value={people} onChange={(ids) => update({ assignee_ids: ids, assignee_id: ids[0] ?? null })} align="end">
          <button
            type="button"
            className="shrink-0"
            data-empty={people.length ? undefined : ""}
            data-icon={people.length ? undefined : ""}
            data-face={people.length ? "" : undefined}
            aria-label={people.length ? `${people.length > 1 ? "Responsables" : "Responsable"} de « ${data.label} » : ${names}. Changer` : `Choisir le responsable de « ${data.label} »`}
            title={people.length ? `${names} · changer` : "Choisir le responsable"}
          >
            {/* Two faces at most: the project keeps room for its name. */}
            {people.length ? <AssigneeFaces ids={people} size="xs" max={2} /> : <UserPlus className="size-3.5" aria-hidden="true" />}
          </button>
        </AssigneePicker>
      </div>
      {task && (
        <button
          type="button"
          onClick={() => ui.openTask(task.id)}
          title={`Ouvrir la tâche « ${task.title} »`}
          className={cn("min-w-0 transition-colors", task.waiting ? "text-navy-600" : STATUS_META[task.status].text)}
        >
          {/* Blocked because it waits for the steps before it: said as such, and quietly — it is nobody's problem. */}
          {task.waiting ? <Hourglass className="size-3 shrink-0" aria-hidden="true" /> : <StatusIcon status={task.status} size={12} />}
          <span className="truncate">Tâche : {task.waiting ? "en attente" : STATUS_META[task.status].label.toLowerCase()}</span>
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
  /** The days changed here, by step: they go to the tasks of this launch, the drawing keeps its own. */
  const [dates, setDates] = useState<Record<string, DateOnly | null>>({});
  const plan = useMemo(() => planLaunch(doc, projects, members), [doc, projects, members]);
  const labelOf = useMemo(() => new Map(plan.tasks.map((t) => [t.step, t.label])), [plan]);
  const unplaced = plan.skipped.filter((s) => s.reason === "no-project");
  const count = plan.tasks.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || count === 0) return;
    setBusy(true);
    const created = await launchWorkflow(workflow.id, doc, about, dates);
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
          Chaque étape qui a un projet devient une tâche dans ce projet, pour les personnes choisies. Les flèches comptent : une tâche
          reste bloquée tant que celles qui la précèdent ne sont pas terminées, puis se débloque d&apos;elle-même. L&apos;échéance de
          chacune se règle ici, ou d&apos;avance sur son étape.
        </DialogDescription>
      </DialogHeader>

      {count > 0 ? (
        <ol className="grid max-h-[40vh] gap-1 overflow-y-auto" aria-label="Tâches qui seront créées">
          {plan.tasks.map((t, i) => {
            const people = t.assignee_ids.map((id) => members[id]).filter(Boolean);
            const due = t.step in dates ? dates[t.step] : t.due_date;
            return (
              <li key={t.step} className="flex min-w-0 items-center gap-3 rounded-xl bg-navy-900/[0.035] px-3 py-2">
                <span className="w-4 shrink-0 text-center text-xs font-semibold text-navy-500 tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-navy-900">{launchTitle(t.label, about)}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <ProjectChip project={projects[t.project_id]} />
                    {people.length ? (
                      <span className="flex min-w-0 items-center gap-1 text-xs text-navy-700">
                        {people.map((m) => (
                          <MemberAvatar key={m.id} member={m} size="xs" className="size-4" />
                        ))}
                        <span className="truncate">{listed(people.map((m) => firstName(m.full_name)))}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-navy-500">Non assignée</span>
                    )}
                    {t.after.length > 0 && (
                      <span className="flex min-w-0 items-center gap-1 text-xs text-navy-500" title="Bloquée jusqu'à ce que ce soit terminé">
                        <Hourglass className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">après {listed(t.after.map((step) => `« ${labelOf.get(step) ?? "…"} »`))}</span>
                      </span>
                    )}
                  </span>
                </span>
                <DuePicker value={due} onChange={(day) => setDates((d) => ({ ...d, [t.step]: day }))} align="end">
                  <button
                    type="button"
                    aria-label={due ? `Échéance de « ${t.label} » : ${formatLongDate(parseDateOnly(due)).toLowerCase()}. Changer` : `Choisir l'échéance de « ${t.label} »`}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors focus-ring",
                      due ? "border-navy-900/[0.14] bg-card font-medium text-navy-900 hover:bg-navy-900/[0.04]" : "border-dashed border-navy-900/25 text-navy-600 hover:border-navy-900/40 hover:text-navy-900",
                    )}
                  >
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {due ? formatShortDate(parseDateOnly(due)) : "Échéance"}
                  </button>
                </DuePicker>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-navy-900/[0.035] px-3.5 py-3 text-[13px] leading-relaxed text-navy-800">
          Aucune étape n&apos;a encore de projet. Sur une étape, cliquez « Sans projet » pour la placer ; à côté, le calendrier lui donne
          une échéance et le visage, une personne.
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
