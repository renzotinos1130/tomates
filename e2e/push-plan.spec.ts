import { expect, test } from "@playwright/test";
import { planPush, type PushContext, type PushEvent, type PushKind, type PushPrefs } from "../src/lib/push";

/**
 * Notifications : qui reçoit quoi, sans écran. La base écrit ce qui s'est passé ; `planPush` en fait
 * les messages de chacun. Personne n'est prévenu de ce qu'il fait lui-même, les choix de chacun
 * décident du reste, et plusieurs nouvelles du même genre tiennent dans un seul message.
 */

const ALL: PushPrefs = { task_created: true, task_done: true, task_blocked: true, tower_record: true, scope: "team" };
const member = (id: string, full_name: string, active = true) => ({ id, full_name, active });
const task = (id: string, title: string, over: Partial<PushContext["tasks"][string]> = {}) => ({
  id,
  title,
  project_id: "web",
  assignee_id: null,
  created_by: "dom",
  archived_at: null,
  ...over,
});

function context(over: Partial<PushContext> = {}): PushContext {
  return {
    members: {
      dom: member("dom", "Dominic Renzetti"),
      maya: member("maya", "Maya Martel"),
      alex: member("alex", "Alexandre Halle"),
      parti: member("parti", "Ancien Membre", false),
    },
    prefs: {},
    tasks: {
      t1: task("t1", "Maquette de la page tarifs", { assignee_id: "maya" }),
      t2: task("t2", "Relire le contrat"),
      t3: task("t3", "Texte de l'infolettre", { assignee_id: "maya" }),
      t4: task("t4", "Intégration", { assignee_id: "alex" }),
      vieux: task("vieux", "Archivée", { archived_at: "2026-01-01T00:00:00Z" }),
      ailleurs: task("ailleurs", "Dans un projet fermé", { project_id: "ferme" }),
    },
    projects: {
      web: { id: "web", name: "Site Web", slug: "site-web", archived_at: null },
      ferme: { id: "ferme", name: "Fermé", slug: "ferme", archived_at: "2026-01-01T00:00:00Z" },
    },
    recipients: ["dom", "maya", "alex", "parti"],
    ...over,
  };
}

let serial = 0;
const event = (kind: PushKind, actor: string, taskId: string | null, detail: Record<string, unknown> = {}): PushEvent => ({
  id: ++serial,
  kind,
  actor_id: actor,
  task_id: taskId,
  detail,
});
/** Les messages d'une personne, en « titre | corps ». */
const said = (plan: Map<string, { title: string; body: string }[]>, who: string) => (plan.get(who) ?? []).map((m) => `${m.title} | ${m.body}`);

test.describe("Notifications — qui reçoit quoi", () => {
  test("une tâche créée : la personne à qui elle est confiée l'apprend comme la sienne, les autres comme une nouvelle, l'auteur pas du tout", () => {
    const plan = planPush([event("task_created", "dom", "t1")], context());
    expect(plan.has("dom")).toBe(false);
    expect(said(plan, "maya")).toEqual(["Dominic vous confie une tâche | Maquette de la page tarifs · Site Web"]);
    expect(said(plan, "alex")).toEqual(["Nouvelle tâche · Site Web | Dominic a créé « Maquette de la page tarifs »."]);
    // Un clic mène à la tâche, dans son projet.
    expect(plan.get("maya")![0].url).toBe("/projets/site-web?tache=t1");
    // Quelqu'un qui n'a plus accès ne reçoit rien, même avec un appareil enregistré.
    expect(plan.has("parti")).toBe(false);
  });

  test("terminée, bloquée : toute l'équipe sauf la personne qui l'a fait ; seul le dernier état d'une tâche est annoncé", () => {
    let plan = planPush([event("task_done", "maya", "t1")], context());
    expect(said(plan, "dom")).toEqual(["Tâche terminée | Maya a terminé « Maquette de la page tarifs » · Site Web"]);
    expect(plan.has("maya")).toBe(false);

    plan = planPush([event("task_blocked", "maya", "t1")], context());
    expect(said(plan, "alex")).toEqual(["Tâche bloquée | Maya signale un blocage : « Maquette de la page tarifs » · Site Web"]);

    // Bloquée puis terminée dans la foulée, et terminée deux fois : une seule nouvelle, la dernière.
    plan = planPush([event("task_blocked", "maya", "t1"), event("task_done", "maya", "t1"), event("task_done", "maya", "t1")], context());
    expect(said(plan, "dom")).toEqual(["Tâche terminée | Maya a terminé « Maquette de la page tarifs » · Site Web"]);
  });

  test("une tâche confiée après coup n'est annoncée qu'à la personne qui la reçoit, et une seule fois", () => {
    const ctx = context({ tasks: { ...context().tasks, t2: task("t2", "Relire le contrat", { assignee_id: "alex" }) } });
    let plan = planPush([event("task_assigned", "dom", "t2", { assignee_id: "alex" })], ctx);
    expect(said(plan, "alex")).toEqual(["Dominic vous confie une tâche | Relire le contrat · Site Web"]);
    expect(plan.has("maya")).toBe(false);

    // Confiée à Maya, puis à Alexandre dans la foulée : seul celui qui l'a maintenant est prévenu.
    plan = planPush([event("task_assigned", "dom", "t2", { assignee_id: "maya" }), event("task_assigned", "dom", "t2", { assignee_id: "alex" })], ctx);
    expect(plan.has("maya")).toBe(false);
    expect(said(plan, "alex")).toHaveLength(1);

    // Créée puis confiée dans le même souffle : la création dit déjà à qui elle est.
    plan = planPush([event("task_created", "dom", "t2"), event("task_assigned", "dom", "t2", { assignee_id: "alex" })], ctx);
    expect(said(plan, "alex")).toEqual(["Dominic vous confie une tâche | Relire le contrat · Site Web"]);
    expect(said(plan, "maya")).toEqual(["Nouvelle tâche · Site Web | Dominic a créé « Relire le contrat »."]);
  });

  test("les choix de chacun : un sujet coupé se tait, « seulement les miennes » ne garde que mes tâches, et ce qu'on me confie passe toujours", () => {
    const prefs = { alex: { ...ALL, task_done: false, scope: "mine" as const }, maya: { ...ALL, task_created: false } };
    // Terminée : Alexandre a coupé le sujet, même pour sa propre tâche.
    let plan = planPush([event("task_done", "dom", "t4")], context({ prefs }));
    expect(plan.has("alex")).toBe(false);
    expect(said(plan, "maya")).toHaveLength(1);

    // « Seulement les miennes » : la tâche d'une autre ne lui est pas annoncée ; la sienne, oui.
    plan = planPush([event("task_blocked", "dom", "t1"), event("task_blocked", "dom", "t4")], context({ prefs }));
    expect(said(plan, "alex")).toEqual(["Tâche bloquée | Dominic signale un blocage : « Intégration » · Site Web"]);
    // …et une tâche que j'ai créée est la mienne aussi.
    plan = planPush([event("task_done", "maya", "t2")], context({ prefs: { dom: { ...ALL, scope: "mine" } } }));
    expect(said(plan, "dom")).toHaveLength(1);

    // « Nouvelle tâche » coupé : Maya n'apprend ni les créations, ni ce qu'on lui confie.
    plan = planPush([event("task_created", "dom", "t1"), event("task_created", "dom", "t2")], context({ prefs }));
    expect(plan.has("maya")).toBe(false);
    // Alexandre (« les miennes ») n'entend parler d'aucune des deux : aucune n'est à lui.
    expect(plan.has("alex")).toBe(false);
    // Mais ce qu'on lui confie lui est toujours annoncé.
    plan = planPush([event("task_created", "dom", "t4")], context({ prefs }));
    expect(said(plan, "alex")).toEqual(["Dominic vous confie une tâche | Intégration · Site Web"]);
  });

  test("plusieurs nouvelles du même genre tiennent dans un message : un workflow lancé ne fait pas sonner quatre fois", () => {
    const batch = [event("task_created", "dom", "t1"), event("task_created", "dom", "t2"), event("task_created", "dom", "t3"), event("task_created", "dom", "t4")];
    const plan = planPush(batch, context());
    // Maya : ses deux tâches d'un côté, les deux autres de l'équipe de l'autre.
    expect(said(plan, "maya")).toEqual([
      "Dominic vous confie 2 tâches | « Maquette de la page tarifs » et « Texte de l'infolettre »",
      "2 nouvelles tâches | Dominic : « Relire le contrat » et « Intégration »",
    ]);
    expect(plan.get("maya")![0].url).toBe("/mes-taches");
    // Alexandre : la sienne, nommée, puis les trois autres en une ligne.
    expect(said(plan, "alex")).toEqual([
      "Dominic vous confie une tâche | Intégration · Site Web",
      "3 nouvelles tâches | Dominic : « Maquette de la page tarifs », « Relire le contrat » et 1 autre",
    ]);
    expect(plan.has("dom")).toBe(false);

    // Deux personnes ont terminé des tâches : le message ne nomme personne.
    const done = planPush([event("task_done", "maya", "t1"), event("task_done", "alex", "t4")], context());
    expect(said(done, "dom")).toEqual(["2 tâches terminées | « Maquette de la page tarifs » et « Intégration »"]);
  });

  test("ce qui n'est plus vrai ne s'annonce pas : tâche supprimée ou archivée, projet fermé, auteur inconnu", () => {
    const plan = planPush(
      [event("task_done", "dom", "partie"), event("task_done", "dom", "vieux"), event("task_done", "dom", "ailleurs"), event("task_done", "inconnu", "t1")],
      context(),
    );
    expect(plan.size).toBe(0);
  });

  test("un titre interminable est coupé, pas le message", () => {
    const long = "Refaire entièrement la page d'accueil ".repeat(8).trim();
    const plan = planPush([event("task_done", "dom", "long")], context({ tasks: { long: task("long", long) } }));
    const body = plan.get("maya")![0].body;
    expect(body.length).toBeLessThan(150);
    expect(body).toContain("…");
    expect(body.endsWith("· Site Web")).toBe(true);
  });

  test("Tomato Tower : la première marque de la semaine, la tête qui change de mains, le record de tous les temps, et le mot pour la personne détrônée", () => {
    let plan = planPush([event("tower_record", "maya", null, { score: 700, previous_member_id: null })], context());
    expect(said(plan, "dom")).toEqual(["Tomato Tower | Maya ouvre la semaine : 700 points. Qui dit mieux ?"]);
    expect(plan.has("maya")).toBe(false);
    expect(plan.get("dom")![0].url).toBe("/arcade");

    plan = planPush([event("tower_record", "dom", null, { score: 12400, previous_member_id: "maya", previous_score: 700 })], context());
    expect(said(plan, "maya")).toEqual(["Tomato Tower | Dominic vient de détruire ton record 🍅 12 400 points. À toi de jouer."]);
    expect(said(plan, "alex")).toEqual(["Tomato Tower | Dominic prend la tête de la semaine : 12 400 points."]);

    // Deux changements de tête dans le même lot : seul le dernier est encore vrai.
    plan = planPush(
      [event("tower_record", "dom", null, { score: 5000, previous_member_id: "maya" }), event("tower_record", "alex", null, { score: 6000, previous_member_id: "dom" })],
      context(),
    );
    expect(said(plan, "maya")).toEqual(["Tomato Tower | Alexandre prend la tête de la semaine : 6 000 points."]);
    expect(said(plan, "dom")).toEqual(["Tomato Tower | Alexandre vient de détruire ton record 🍅 6 000 points. À toi de jouer."]);
    expect(plan.has("alex")).toBe(false);

    // Le record de tous les temps tombe : c'est la nouvelle, dite seule, même si la tête de la semaine change avec lui.
    plan = planPush(
      [event("tower_record", "alex", null, { score: 31000, previous_member_id: "dom", all_time: true, all_time_member_id: "maya", all_time_score: 28000 })],
      context(),
    );
    expect(said(plan, "maya")).toEqual(["Tomato Tower | Alexandre vient de détruire ton record de tous les temps 🍅 31 000 points. À toi de jouer."]);
    expect(said(plan, "dom")).toEqual(["Tomato Tower | Alexandre bat le record de tous les temps : 31 000 points."]);
    // Le sujet coupé, ou un score qui n'en est pas un : rien.
    plan = planPush([event("tower_record", "maya", null, { score: 700 })], context({ prefs: { dom: { ...ALL, tower_record: false } } }));
    expect(plan.has("dom")).toBe(false);
    expect(planPush([event("tower_record", "maya", null, { score: "beaucoup" })], context()).size).toBe(0);
  });

  test("seuls ceux qui ont un appareil reçoivent quelque chose", () => {
    const plan = planPush([event("task_done", "dom", "t1")], context({ recipients: ["alex"] }));
    expect([...plan.keys()]).toEqual(["alex"]);
  });
});
