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

/** « Maya », « Maya et Antoine », « Maya, Antoine et Jimmy ». */
export function listed(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** An « assignee » event carries the people before and after, ids separated by commas. */
function peopleChange(e: TaskEvent) {
  const ids = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);
  const before = ids(e.old_value);
  const after = ids(e.new_value);
  return { before, after, added: after.filter((id) => !before.includes(id)), removed: before.filter((id) => !after.includes(id)) };
}

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
      const { before, after, added, removed } = peopleChange(e);
      const first = (ids: string[]) => listed(ids.map((id) => (ctx.members[id] ? firstName(ctx.members[id].full_name) : "quelqu'un")));
      if (after.length === 0) return { verb: before.length > 1 ? "a retiré les responsables de" : "a retiré le responsable de" };
      // Someone joins those who were there, or leaves them: said as such. Anything else is a new hand-over.
      if (before.length > 0 && removed.length === 0) return { verb: "a aussi confié", detail: `à ${first(added)}` };
      if (added.length === 0) return { verb: `a retiré ${first(removed)} de` };
      return { verb: "a assigné", detail: `à ${first(after)}` };
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
    case "attached":
      return { verb: "a joint un fichier à" };
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
      const { before, after, added, removed } = peopleChange(e);
      const full = (ids: string[]) => listed(ids.map((id) => ctx.members[id]?.full_name ?? "quelqu'un"));
      if (after.length === 0) return before.length > 1 ? "a retiré les responsables" : "a retiré le responsable";
      if (before.length > 0 && removed.length === 0) return `a ajouté ${full(added)} à la tâche`;
      if (added.length === 0) return `a retiré ${full(removed)} de la tâche`;
      return `a assigné la tâche à ${full(after)}`;
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
    case "attached":
      return e.new_value ? `a joint « ${e.new_value} »` : "a joint un fichier";
    default:
      return "a modifié la tâche";
  }
}
