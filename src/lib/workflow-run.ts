/**
 * From a drawing to work: what launching a workflow creates.
 *
 * Every step that has a project becomes one task in that project, for the
 * person chosen on the step, in the order of the drawing (a step comes after
 * the steps that lead to it). A trigger is what starts the process, not work
 * to do: it makes no task. Pure functions: the store does the writing.
 */
import type { ID, Member, Project, WorkflowDoc, WorkflowStep } from "./types";

export interface PlannedTask {
  /** The id of the step in the drawing. */
  step: string;
  label: string;
  detail: string;
  project_id: ID;
  assignee_id: ID | null;
  /** The steps that lead straight to this one, by name. */
  after: string[];
}

export interface SkippedStep {
  step: string;
  label: string;
  /** A trigger is not work; a step without a project has nowhere to go. */
  reason: "trigger" | "no-project";
}

export interface LaunchPlan {
  tasks: PlannedTask[];
  skipped: SkippedStep[];
}

/** The steps in the order of the drawing: a step after everything that leads to it, left to right otherwise. */
export function stepsInOrder(doc: WorkflowDoc): WorkflowDoc["nodes"] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const waiting = new Map(doc.nodes.map((n) => [n.id, 0]));
  for (const e of doc.edges) if (byId.has(e.source) && byId.has(e.target)) waiting.set(e.target, (waiting.get(e.target) ?? 0) + 1);
  const leftToRight = (a: string, b: string) => {
    const pa = byId.get(a)!.position;
    const pb = byId.get(b)!.position;
    return pa.x - pb.x || pa.y - pb.y || (a < b ? -1 : 1);
  };
  const ready = [...waiting].filter(([, n]) => n === 0).map(([id]) => id).sort(leftToRight);
  const out: WorkflowDoc["nodes"] = [];
  while (ready.length) {
    const id = ready.shift()!;
    out.push(byId.get(id)!);
    for (const e of doc.edges) {
      if (e.source !== id || !waiting.has(e.target)) continue;
      const left = (waiting.get(e.target) ?? 1) - 1;
      waiting.set(e.target, left);
      if (left === 0) {
        ready.push(e.target);
        ready.sort(leftToRight);
      }
    }
  }
  // A loop cannot be drawn (the canvas refuses it); should one be stored anyway, its steps come last.
  for (const n of doc.nodes) if (!out.includes(n)) out.push(n);
  return out;
}

export function planLaunch(doc: WorkflowDoc, projects: Record<ID, Project>, members: Record<ID, Member>): LaunchPlan {
  const labelOf = new Map(doc.nodes.map((n) => [n.id, n.data.label]));
  const tasks: PlannedTask[] = [];
  const skipped: SkippedStep[] = [];
  for (const node of stepsInOrder(doc)) {
    const step: WorkflowStep = node.data;
    if (step.kind === "trigger") {
      skipped.push({ step: node.id, label: step.label, reason: "trigger" });
      continue;
    }
    const project = step.project_id ? projects[step.project_id] : undefined;
    if (!project || project.archived_at) {
      skipped.push({ step: node.id, label: step.label, reason: "no-project" });
      continue;
    }
    const person = step.assignee_id ? members[step.assignee_id] : undefined;
    tasks.push({
      step: node.id,
      label: step.label,
      detail: step.detail,
      project_id: project.id,
      assignee_id: person?.active ? person.id : null,
      after: doc.edges.filter((e) => e.target === node.id).map((e) => labelOf.get(e.source)).filter((l): l is string => !!l),
    });
  }
  return { tasks, skipped };
}

/** The title of a task made from a step: the step, and what this launch is about when it was said. */
export function launchTitle(label: string, about: string): string {
  const what = about.trim().replace(/\s+/g, " ");
  return (what ? `${label} — ${what}` : label).slice(0, 200);
}

/** What the task says of where it comes from, after the step's own description. */
export function launchDescription(task: PlannedTask): string {
  const after = task.after.length ? `Après : ${task.after.map((l) => `« ${l} »`).join(", ")}.` : "";
  return [task.detail.trim(), after].filter(Boolean).join("\n\n");
}
