/**
 * From a drawing to work: what launching a workflow creates.
 *
 * Every step that has a project becomes one task in that project, for the
 * people chosen on the step, due on the day the step says, in the order of the drawing (a step comes after
 * the steps that lead to it). The arrows become dependencies: the task of a
 * step waits for the tasks of the steps that lead to it, and stays blocked
 * until they are finished. A trigger is what starts the process, not work
 * to do: it makes no task. Pure functions: the store does the writing.
 */
import { assigneesOf } from "./task-logic";
import type { DateOnly, ID, Member, Project, WorkflowDoc, WorkflowStep } from "./types";

export interface PlannedTask {
  /** The id of the step in the drawing. */
  step: string;
  label: string;
  detail: string;
  project_id: ID;
  /** The people of the step who still have access. */
  assignee_ids: ID[];
  /** The day the step is due, when it says one. */
  due_date: DateOnly | null;
  /**
   * The steps this one waits for, by id: the nearest ones upstream that make a
   * task. A step that makes none (a trigger, a step without a project) is
   * passed through, so the order of the drawing holds across it.
   */
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

/** A real day, written YYYY-MM-DD: what a saved drawing may hold is not trusted to be one. */
export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

export function planLaunch(doc: WorkflowDoc, projects: Record<ID, Project>, members: Record<ID, Member>): LaunchPlan {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  /** Why a step makes no task, or null when it makes one. */
  const noTask = (step: WorkflowStep): SkippedStep["reason"] | null => {
    if (step.kind === "trigger") return "trigger";
    const project = step.project_id ? projects[step.project_id] : undefined;
    return !project || project.archived_at ? "no-project" : null;
  };
  /** The nearest steps upstream of `id` that make a task, in the order of the arrows. */
  const waitsFor = (id: string): string[] => {
    const found: string[] = [];
    const seen = new Set<string>([id]);
    const climb = (to: string) => {
      for (const e of doc.edges) {
        const from = byId.get(e.source);
        if (e.target !== to || !from || seen.has(from.id)) continue;
        seen.add(from.id);
        if (noTask(from.data)) climb(from.id);
        else found.push(from.id);
      }
    };
    climb(id);
    return found;
  };
  const tasks: PlannedTask[] = [];
  const skipped: SkippedStep[] = [];
  for (const node of stepsInOrder(doc)) {
    const step: WorkflowStep = node.data;
    const reason = noTask(step);
    if (reason) {
      skipped.push({ step: node.id, label: step.label, reason });
      continue;
    }
    const project = projects[step.project_id!];
    tasks.push({
      step: node.id,
      label: step.label,
      detail: step.detail,
      project_id: project.id,
      assignee_ids: assigneesOf(step).filter((id) => members[id]?.active),
      due_date: isDateOnly(step.due_date) ? step.due_date : null,
      after: waitsFor(node.id),
    });
  }
  return { tasks, skipped };
}

/** The title of a task made from a step: the step, and what this launch is about when it was said. */
export function launchTitle(label: string, about: string): string {
  const what = about.trim().replace(/\s+/g, " ");
  return (what ? `${label} — ${what}` : label).slice(0, 200);
}

/** The description of a task made from a step: the step's own. What it waits for is a dependency, not a sentence. */
export function launchDescription(task: PlannedTask): string {
  return task.detail.trim();
}
