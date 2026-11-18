import { PRIORITY_META, STATUS_META } from "./constants";
import { formatShortDate, parseDateOnly } from "./dates";
import type { ID, Member, Project, TaskEvent, TaskPriority, TaskStatus } from "./types";
import { firstName } from "./utils";

interface Ctx {
  members: Record<ID, Member>;
  projects: Record<ID, Project>;
  /** The tasks, to name the ones a task depends on. Without them a dependency is « une autre tâche ». */
  tasks?: Record<ID, { title: string } | undefined>;
}

export interface EventText {
  /** e.g. « a terminé » — reads naturally after the actor's first name. */
  verb: string;
  /** Optional complement shown after the task title in feeds, or alone in a task timeline. */
  detail?: string;
  tone?: "done" | "blocked" | "neutral";
}

// « waiting » is how the log writes « blocked » for a task held back by another: nobody reported a problem.
const statusLabel = (v: string | null) => (v === "waiting" ? "En attente" : v ? (STATUS_META[v as TaskStatus]?.label ?? v) : "—");
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

/** A « dependency » event carries the tasks before and after, ids separated by commas. */
function dependencyChange(e: TaskEvent, ctx: Ctx) {
  const ids = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);
  const before = ids(e.old_value);
  const after = ids(e.new_value);
  /** « A », or « A » et 2 autres tâches. A task deleted since has no name left. */
  const named = (list: string[]) => {
    const title = ctx.tasks?.[list[0]]?.title;
    const first = title ? `« ${title} »` : "une autre tâche";
    return list.length > 1 ? `${first} et ${list.length - 1} ${list.length > 2 ? "autres tâches" : "autre tâche"}` : first;
  };
  return { added: after.filter((id) => !before.includes(id)), removed: before.filter((id) => !after.includes(id)), named };
}

/** French sentence fragments for a history event. */
export function describeEvent(e: TaskEvent, ctx: Ctx): EventText {
  switch (e.kind) {
    case "created":
      return { verb: "a créé" };
    case "status":
      if (e.new_value === "done") return { verb: "a terminé", tone: "done" };
      if (e.new_value === "blocked") return { verb: "a signalé un blocage sur", tone: "blocked" };
      if (e.new_value === "waiting") return { verb: "a remis en attente" };
      if (e.old_value === "blocked" && e.new_value === "todo") return { verb: "a débloqué" };
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
    case "dependency": {
      const { added, named } = dependencyChange(e, ctx);
      if (added.length) return { verb: "a fait dépendre", detail: `de ${named(added)}` };
      return { verb: "a retiré une dépendance de" };
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
      if (e.new_value === "waiting") return "a remis la tâche en attente : elle dépend d'une tâche à terminer";
      if (e.old_value === "blocked" && e.new_value === "todo") return "a débloqué la tâche";
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
    case "dependency": {
      const { added, removed, named } = dependencyChange(e, ctx);
      if (added.length) return `a fait dépendre la tâche de ${named(added)}`;
      return removed.length === 1 && ctx.tasks?.[removed[0]] ? `a retiré la dépendance à ${named(removed)}` : "a retiré une dépendance";
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
