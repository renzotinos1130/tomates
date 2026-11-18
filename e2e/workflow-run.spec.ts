import { expect, test } from "@playwright/test";
import type { Member, Project, WorkflowDoc } from "../src/lib/types";
import { isDateOnly, launchDescription, launchTitle, planLaunch, stepsInOrder } from "../src/lib/workflow-run";

/**
 * D'un dessin à du travail : ce que « Créer les tâches » fabrique, sans écran. Une tâche par étape
 * qui a un projet, pour la ou les personnes de l'étape, dans l'ordre du dessin.
 */

const project = (id: string, archived = false) => ({ id, name: id, archived_at: archived ? "2026-01-01T00:00:00Z" : null }) as unknown as Project;
const member = (id: string, active = true) => ({ id, full_name: id, active }) as unknown as Member;
const projects = { app: project("app"), web: project("web"), old: project("old", true) };
const members = { maya: member("maya"), marco: member("marco"), parti: member("parti", false) };

const step = (id: string, x: number, y: number, data: Partial<WorkflowDoc["nodes"][number]["data"]> = {}) => ({
  id,
  position: { x, y },
  data: { label: id, detail: "", kind: "agent" as const, ...data },
});

test.describe("Workflows — du dessin aux tâches", () => {
  test("l'ordre est celui du dessin : une étape vient après tout ce qui y mène, de gauche à droite sinon", () => {
    const doc: WorkflowDoc = {
      nodes: [step("fin", 0, 0), step("b", 300, 200), step("a", 300, 0), step("debut", 900, 0)],
      edges: [
        { id: "1", source: "debut", target: "a" },
        { id: "2", source: "debut", target: "b" },
        { id: "3", source: "a", target: "fin" },
        { id: "4", source: "b", target: "fin" },
      ],
    };
    expect(stepsInOrder(doc).map((n) => n.id)).toEqual(["debut", "a", "b", "fin"]);
  });

  test("une tâche par étape qui a un projet ; un déclencheur n'est pas du travail, une étape sans projet n'a nulle part où aller", () => {
    const doc: WorkflowDoc = {
      nodes: [
        step("idee", 0, 0, { kind: "trigger", project_id: "app" }),
        step("texte", 200, 0, { project_id: "app", assignee_id: "maya", detail: "Trois accroches." }),
        step("visuels", 400, 0, { project_id: "web", assignee_id: "parti" }),
        step("flou", 600, 0),
        step("vieux", 800, 0, { project_id: "old", assignee_id: "marco" }),
      ],
      edges: [
        { id: "1", source: "idee", target: "texte" },
        { id: "2", source: "texte", target: "visuels" },
      ],
    };
    const plan = planLaunch(doc, projects, members);
    expect(plan.tasks.map((t) => [t.step, t.project_id, t.assignee_ids])).toEqual([
      // Une étape dessinée avant qu'on puisse en nommer plusieurs : sa seule personne.
      ["texte", "app", ["maya"]],
      // Quelqu'un qui n'a plus accès ne reçoit pas de tâche : elle est créée sans responsable.
      ["visuels", "web", []],
    ]);
    expect(plan.skipped).toEqual([
      { step: "idee", label: "idee", reason: "trigger" },
      { step: "flou", label: "flou", reason: "no-project" },
      // Un projet archivé ne reçoit plus rien.
      { step: "vieux", label: "vieux", reason: "no-project" },
    ]);
    // La tâche dit ce qui la précède.
    expect(plan.tasks[1].after).toEqual(["texte"]);
    expect(launchDescription(plan.tasks[0])).toBe("Trois accroches.\n\nAprès : « idee ».");
    expect(launchDescription(plan.tasks[1])).toBe("Après : « texte ».");
  });

  test("une étape confiée à plusieurs fait une seule tâche, à tous leurs noms ; qui n'a plus accès en est retiré", () => {
    const doc: WorkflowDoc = {
      nodes: [
        step("tournage", 0, 0, { project_id: "app", assignee_ids: ["maya", "marco"] }),
        // La liste a le dernier mot sur l'ancienne personne unique (gardée pour les pages restées ouvertes).
        step("montage", 200, 0, { project_id: "app", assignee_ids: ["marco", "parti"], assignee_id: "maya" }),
        step("diffusion", 400, 0, { project_id: "app", assignee_ids: [] }),
      ],
      edges: [],
    };
    expect(planLaunch(doc, projects, members).tasks.map((t) => [t.step, t.assignee_ids])).toEqual([
      ["tournage", ["maya", "marco"]],
      ["montage", ["marco"]],
      ["diffusion", []],
    ]);
  });

  test("l'échéance d'une étape devient celle de sa tâche ; ce qui n'est pas un vrai jour est ignoré", () => {
    const doc: WorkflowDoc = {
      nodes: [
        step("design", 0, 0, { project_id: "app", due_date: "2026-11-24" }),
        step("texte", 200, 0, { project_id: "app" }),
        step("faux", 400, 0, { project_id: "app", due_date: "2026-02-31" }),
        step("texte libre", 600, 0, { project_id: "app", due_date: "bientôt" as never }),
      ],
      edges: [],
    };
    expect(planLaunch(doc, projects, members).tasks.map((t) => [t.step, t.due_date])).toEqual([
      ["design", "2026-11-24"],
      ["texte", null],
      ["faux", null],
      ["texte libre", null],
    ]);
    expect(isDateOnly("2028-02-29")).toBe(true);
    expect(isDateOnly("2027-02-29")).toBe(false);
    expect(isDateOnly("24 nov")).toBe(false);
    expect(isDateOnly(null)).toBe(false);
  });

  test("le nom d'une tâche : l'étape, et ce pour quoi le workflow est lancé quand on l'a dit", () => {
    expect(launchTitle("Créer les visuels", "")).toBe("Créer les visuels");
    expect(launchTitle("Créer les visuels", "  Infolettre   de décembre ")).toBe("Créer les visuels — Infolettre de décembre");
    expect(launchTitle("x".repeat(300), "y").length).toBe(200);
  });
});
