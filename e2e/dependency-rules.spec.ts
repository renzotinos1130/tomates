import { expect, test } from "@playwright/test";
import { describeEvent, describeEventInTask } from "../src/lib/activity";
import { diffTaskEvents, isStuck, pendingDependencies, settleDependents, withDerivedFields, wouldLoop } from "../src/lib/task-logic";
import type { Member, Project, Task, TaskEvent } from "../src/lib/types";

/**
 * Dépendances, sans écran : les règles que le navigateur applique tout de suite (et que le mode démo
 * applique seul) sont celles de la base (supabase/tests/database/dependencies.test.sql vérifie les
 * mêmes cas). Une tâche qui dépend d'une autre est bloquée tant que l'autre reste à faire, puis se
 * débloque d'elle-même.
 */

const T0 = "2026-11-10T09:00:00.000Z";
const NOW = "2026-11-18T15:00:00.000Z";

const blank = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  project_id: "app",
  title: id,
  description: "",
  status: "todo",
  priority: "normal",
  assignee_id: null,
  assignee_ids: [],
  due_date: null,
  position: 0,
  meeting_id: null,
  created_by: null,
  created_at: T0,
  updated_at: T0,
  status_changed_at: T0,
  completed_at: null,
  archived_at: null,
  workflow_id: null,
  workflow_step: null,
  depends_on: [],
  waiting: false,
  ...over,
});

/** Un petit monde de tâches qui se comporte comme la base : chaque écriture règle la tâche, puis celles qui en dépendent. */
class World {
  tasks = new Map<string, Task>();
  events: TaskEvent[] = [];
  find = (id: string) => this.tasks.get(id);
  add(id: string, over: Partial<Task> = {}) {
    const task = withDerivedFields(null, blank(id, over), NOW, this.find);
    this.tasks.set(id, task);
    return task;
  }
  set(id: string, patch: Partial<Task>) {
    const prev = this.tasks.get(id)!;
    const next = withDerivedFields(prev, { ...prev, ...patch }, NOW, this.find);
    this.tasks.set(id, next);
    this.events.push(...diffTaskEvents(prev, next, "dom", NOW));
    this.follow(prev, next);
    return next;
  }
  remove(id: string) {
    const prev = this.tasks.get(id)!;
    this.tasks.delete(id);
    this.follow(prev, null);
  }
  private follow(prev: Task, next: Task | null) {
    for (const settled of settleDependents(prev, next, [...this.tasks.values()], this.find, NOW)) {
      const before = this.tasks.get(settled.id)!;
      this.tasks.set(settled.id, settled);
      this.events.push(...diffTaskEvents(before, settled, "dom", NOW));
    }
  }
  /** « statut | en attente » d'une tâche. */
  state(id: string) {
    const t = this.tasks.get(id)!;
    return `${t.status}${t.waiting ? " (attend)" : ""}`;
  }
  log(id: string, kind: TaskEvent["kind"]) {
    return this.events.filter((e) => e.task_id === id && e.kind === kind).map((e) => `${e.old_value ?? "∅"} → ${e.new_value ?? "∅"}`);
  }
}

test.describe("Dépendances — les règles", () => {
  test("une tâche qui dépend d'une autre est bloquée, ne se commence ni ne se termine, et se débloque quand l'autre est terminée", () => {
    const w = new World();
    w.add("visuels");
    w.add("texte", { depends_on: ["visuels"] });
    expect(w.state("texte")).toBe("blocked (attend)");
    expect(w.state("visuels")).toBe("todo");
    expect(pendingDependencies(w.find("texte")!, w.find).map((t) => t.id)).toEqual(["visuels"]);

    // Quel que soit le statut demandé, elle reste où elle est.
    w.set("texte", { status: "in_progress" });
    expect(w.state("texte")).toBe("blocked (attend)");
    w.set("texte", { status: "done" });
    expect(w.state("texte")).toBe("blocked (attend)");
    expect(w.find("texte")!.completed_at).toBeNull();
    // Tout le reste se modifie.
    w.set("texte", { title: "Texte, v2", priority: "high" });
    expect(w.find("texte")!.title).toBe("Texte, v2");

    // L'autre commence : rien ne change. Elle se termine : la tâche revient à « À faire », seule.
    w.set("visuels", { status: "in_progress" });
    expect(w.state("texte")).toBe("blocked (attend)");
    w.set("visuels", { status: "done" });
    expect(w.state("texte")).toBe("todo");
    expect(w.find("texte")!.status_changed_at).toBe(NOW);
    w.set("texte", { status: "in_progress" });
    expect(w.state("texte")).toBe("in_progress");

    // L'autre est rouverte : elle attend de nouveau.
    w.set("visuels", { status: "todo" });
    expect(w.state("texte")).toBe("blocked (attend)");
  });

  test("plusieurs dépendances : toutes doivent être terminées ; une tâche archivée ou supprimée ne retient personne", () => {
    const w = new World();
    w.add("a");
    w.add("b");
    w.add("c", { depends_on: ["a", "b"] });
    w.set("a", { status: "done" });
    expect(w.state("c")).toBe("blocked (attend)");
    w.set("b", { status: "done" });
    expect(w.state("c")).toBe("todo");

    w.add("tournage");
    w.add("montage", { depends_on: ["tournage"] });
    w.set("tournage", { archived_at: NOW });
    expect(w.state("montage")).toBe("todo");
    w.set("tournage", { archived_at: null });
    expect(w.state("montage")).toBe("blocked (attend)");
    w.remove("tournage");
    expect(w.find("montage")!.depends_on).toEqual([]);
    expect(w.state("montage")).toBe("todo");
  });

  test("une chaîne : chaque tâche attend celle d'avant, et la première terminée ne libère que la suivante", () => {
    const w = new World();
    w.add("un");
    w.add("deux", { depends_on: ["un"] });
    w.add("trois", { depends_on: ["deux"] });
    expect([w.state("un"), w.state("deux"), w.state("trois")]).toEqual(["todo", "blocked (attend)", "blocked (attend)"]);
    w.set("un", { status: "done" });
    expect([w.state("deux"), w.state("trois")]).toEqual(["todo", "blocked (attend)"]);
    w.set("deux", { status: "done" });
    expect(w.state("trois")).toBe("todo");
  });

  test("la liste est nettoyée, et deux tâches ne peuvent pas s'attendre l'une l'autre", () => {
    const w = new World();
    w.add("faite", { status: "done" });
    w.add("publier");
    w.set("publier", { depends_on: ["publier", "faite", "faite", "inconnue"] });
    // Ni elle-même, ni deux fois la même, ni une tâche qui n'existe pas ; et une tâche terminée ne retient rien.
    expect(w.find("publier")!.depends_on).toEqual(["faite"]);
    expect(w.state("publier")).toBe("todo");

    w.add("annoncer", { depends_on: ["publier"] });
    w.add("mesurer", { depends_on: ["annoncer"] });
    // « publier » ne peut dépendre ni d'« annoncer » (qui l'attend), ni de « mesurer » (qui l'attend par « annoncer »).
    expect(wouldLoop("publier", "annoncer", w.find)).toBe(true);
    expect(wouldLoop("publier", "mesurer", w.find)).toBe(true);
    expect(wouldLoop("publier", "publier", w.find)).toBe(true);
    // Dans l'autre sens, rien ne s'y oppose.
    expect(wouldLoop("mesurer", "publier", w.find)).toBe(false);
    expect(wouldLoop("publier", "faite", w.find)).toBe(false);
  });

  test("ce qui est terminé le reste ; un blocage signalé à la main n'est pas une attente", () => {
    const w = new World();
    w.add("deja", { status: "done" });
    w.add("pas commencee");
    w.set("deja", { depends_on: ["pas commencee"] });
    // Une dépendance ajoutée après coup ne défait pas une tâche terminée…
    expect(w.state("deja")).toBe("done");
    expect(w.find("deja")!.completed_at).not.toBeNull();
    // …mais rouverte, elle attend comme les autres.
    w.set("deja", { status: "todo" });
    expect(w.state("deja")).toBe("blocked (attend)");

    w.add("en panne");
    w.set("en panne", { status: "blocked" });
    expect(w.state("en panne")).toBe("blocked");
    expect(isStuck(w.find("en panne")!)).toBe(true);
    expect(isStuck(w.find("deja")!)).toBe(false);
    // Une dépendance déjà terminée ne lève pas un blocage signalé.
    w.add("finie", { status: "done" });
    w.set("en panne", { depends_on: ["finie"] });
    expect(w.state("en panne")).toBe("blocked");

    // La dépendance retirée à la main : la tâche est libre.
    w.add("attendait", { depends_on: ["pas commencee"] });
    w.set("attendait", { depends_on: [] });
    expect(w.state("attendait")).toBe("todo");
  });

  test("le journal distingue une attente d'un blocage, et dit de quoi une tâche dépend", () => {
    const w = new World();
    w.add("visuels");
    w.add("texte");
    // La dépendance ajoutée : une ligne pour la liste, aucune pour le statut (elle dit déjà tout).
    w.set("texte", { depends_on: ["visuels"] });
    expect(w.log("texte", "dependency")).toEqual(["∅ → visuels"]);
    expect(w.log("texte", "status")).toEqual([]);
    // Libérée, puis remise en attente : jamais « blocked », personne n'a signalé de problème.
    w.set("visuels", { status: "done" });
    w.set("visuels", { status: "todo" });
    expect(w.log("texte", "status")).toEqual(["blocked → todo", "todo → waiting"]);
    // Un blocage signalé à la main reste « blocked ».
    w.set("visuels", { status: "blocked" });
    expect(w.log("visuels", "status").at(-1)).toBe("todo → blocked");

    // Les phrases.
    const ctx = {
      members: { dom: { id: "dom", full_name: "Dominic Renzetti" } as Member },
      projects: {} as Record<string, Project>,
      tasks: { visuels: { title: "Créer les visuels" }, texte: { title: "Rédiger le texte" } },
    };
    const [added] = w.events.filter((e) => e.kind === "dependency");
    expect(describeEvent(added, ctx)).toEqual({ verb: "a fait dépendre", detail: "de « Créer les visuels »" });
    expect(describeEventInTask(added, ctx)).toBe("a fait dépendre la tâche de « Créer les visuels »");
    const [freed, held] = w.events.filter((e) => e.task_id === "texte" && e.kind === "status");
    expect(describeEvent(freed, ctx).verb).toBe("a débloqué");
    expect(describeEventInTask(freed, ctx)).toBe("a débloqué la tâche");
    expect(describeEvent(held, ctx).verb).toBe("a remis en attente");
    w.set("texte", { depends_on: [] });
    const removed = w.events.filter((e) => e.kind === "dependency").at(-1)!;
    expect(describeEvent(removed, ctx).verb).toBe("a retiré une dépendance de");
    expect(describeEventInTask(removed, ctx)).toBe("a retiré la dépendance à « Créer les visuels »");
  });

  test("une tâche enregistrée avant les dépendances n'en a aucune, et rien ne casse", () => {
    const w = new World();
    const old = { ...blank("ancienne") } as Partial<Task>;
    delete old.depends_on;
    delete old.waiting;
    w.tasks.set("ancienne", old as Task);
    const next = w.set("ancienne", { status: "in_progress" });
    expect(next.depends_on).toEqual([]);
    expect(next.waiting).toBe(false);
    expect(next.status).toBe("in_progress");
  });
});
