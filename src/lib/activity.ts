import { PRIORITY_META, STATUS_META } from "./constants";
import { formatShortDate, parseDateOnly } from "./dates";
import type { ID, Member, Project, TaskEvent, TaskPriority, TaskStatus } from "./types";
import { firstName } from "./utils";

interface Ctx {
  members: Record<ID, Member>;
  projects: Record<ID, Project>;
}

export interface EventText {
  /** e.g. « a terminé » — reads naturally after the actor's first name. */
  verb: string;
  /** Optional complement shown after the task title in feeds, or alone in a task timeline. */
  detail?: string;
  tone?: "done" | "blocked" | "neutral";
}

const statusLabel = (v: string | null) => (v ? (STATUS_META[v as TaskStatus]?.label ?? v) : "—");
const priorityLabel = (v: string | null) => (v ? (PRIORITY_META[v as TaskPriority]?.label ?? v) : "—");

/** French sentence fragments for a history event. */
export function describeEvent(e: TaskEvent, ctx: Ctx): EventText {
  switch (e.kind) {
    case "created":
      return { verb: "a créé" };
    case "status":
      if (e.new_value === "done") return { verb: "a terminé", tone: "done" };
      if (e.new_value === "blocked") return { verb: "a signalé un blocage sur", tone: "blocked" };
      if (e.new_value === "review") return { verb: "a envoyé en validation" };
      if (e.new_value === "in_progress") return { verb: "a commencé" };
      return { verb: "a déplacé", detail: `${statusLabel(e.old_value)} → ${statusLabel(e.new_value)}` };
    case "priority":
      return { verb: "a changé la priorité de", detail: `${priorityLabel(e.old_value)} → ${priorityLabel(e.new_value)}` };
    case "assignee": {
      const to = e.new_value ? ctx.members[e.new_value] : null;
      if (!to) return { verb: "a retiré le responsable de" };
      return { verb: "a assigné", detail: `à ${firstName(to.full_name)}` };
    }
    case "due_date":
      if (!e.new_value) return { verb: "a retiré l'échéance de" };
      return { verb: "a fixé l'échéance de", detail: `au ${formatShortDate(parseDateOnly(e.new_value))}` };
    case "title":
      return { verb: "a renommé" };
    case "project": {
      const to = e.new_value ? ctx.projects[e.new_value] : null;
      return { verb: "a déplacé", detail: to ? `vers ${to.name}` : undefined };
    }
    case "archived":
      return { verb: "a archivé" };
    case "unarchived":
      return { verb: "a restauré" };
    case "commented":
      return { verb: "a commenté" };
    default:
      return { verb: "a modifié" };
  }
}

/** Same event, phrased for the task's own timeline (no task title). */
export function describeEventInTask(e: TaskEvent, ctx: Ctx): string {
  switch (e.kind) {
    case "created":
      return "a créé la tâche";
    case "status":
      if (e.new_value === "done") return "a terminé la tâche";
      return `a changé le statut : ${statusLabel(e.old_value)} → ${statusLabel(e.new_value)}`;
    case "priority":
      return `a changé la priorité : ${priorityLabel(e.old_value)} → ${priorityLabel(e.new_value)}`;
    case "assignee": {
      const to = e.new_value ? ctx.members[e.new_value] : null;
      return to ? `a assigné la tâche à ${to.full_name}` : "a retiré le responsable";
    }
    case "due_date":
      return e.new_value
        ? `a fixé l'échéance au ${formatShortDate(parseDateOnly(e.new_value))}`
        : "a retiré l'échéance";
    case "title":
      return "a renommé la tâche";
    case "project": {
      const to = e.new_value ? ctx.projects[e.new_value] : null;
      return to ? `a déplacé la tâche vers ${to.name}` : "a changé le projet";
    }
    case "archived":
      return "a archivé la tâche";
    case "unarchived":
      return "a restauré la tâche";
    default:
      return "a modifié la tâche";
  }
}
