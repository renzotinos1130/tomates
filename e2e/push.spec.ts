import { expect, test, type Page, type Worker } from "@playwright/test";
import { pushServiceStandIn } from "./push-mock";

/**
 * Notifications push, dans le navigateur : l'écran des paramètres, le service worker qui affiche ce
 * qu'il reçoit, et le clic qui ouvre la bonne tâche. En mode démo rien ne voyage (pas de serveur) :
 * l'envoi chiffré, lui, est vérifié contre une vraie base (voir le README).
 *
 * Le Chromium complet, et non sa version sans interface par défaut : celle-ci refuse d'office les
 * notifications (c'est l'objet de push-states.spec.ts).
 */
test.use({ channel: "chromium", permissions: ["notifications"] });

/**
 * Fait recevoir un événement au service worker, et attend qu'il ait fini d'y répondre.
 *
 * Un vrai message arrive du service de push du navigateur, qu'un test ne peut pas joindre. On remet
 * donc au worker un événement du même nom, avec ce que le sien porterait (`data` pour un message,
 * `notification` pour un clic) ; `waitUntil` nous rend la promesse du travail, que l'on attend ici.
 */
function deliver(worker: Worker, type: "push" | "notificationclick", carried: { json?: unknown; text?: string; url?: string }) {
  return worker.evaluate(
    async ({ type, carried }) => {
      // Ce que le worker demande d'afficher est noté au passage (puis réellement affiché).
      const scope = self as unknown as { __shown?: Shown[]; registration: ServiceWorkerRegistration };
      if (!scope.__shown) {
        const asked: Shown[] = (scope.__shown = []);
        const real = scope.registration.showNotification.bind(scope.registration);
        scope.registration.showNotification = (title: string, options?: NotificationOptions) => {
          asked.push({ title, body: options?.body, tag: options?.tag, url: (options?.data as { url?: string } | undefined)?.url });
          return real(title, options);
        };
      }
      const event = new Event(type);
      let work: Promise<unknown> = Promise.resolve();
      Object.assign(event, {
        waitUntil: (promise: Promise<unknown>) => {
          work = promise;
        },
        data: {
          json: () => {
            if (carried.json === undefined) throw new SyntaxError("pas du JSON");
            return carried.json;
          },
          text: () => carried.text ?? JSON.stringify(carried.json),
        },
        notification: { close: () => undefined, data: { url: carried.url } },
      });
      self.dispatchEvent(event);
      await work;
    },
    { type, carried },
  );
}

interface Shown {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
}

async function openSettings(page: Page) {
  await page.addInitScript(pushServiceStandIn);
  // Ce que la page demande au navigateur d'afficher est noté au passage (puis réellement affiché).
  await page.addInitScript(() => {
    const asked: Shown[] = ((window as unknown as { __shown: Shown[] }).__shown = []);
    const real = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title: string, options?: NotificationOptions) {
      asked.push({ title, body: options?.body, tag: options?.tag, url: (options?.data as { url?: string } | undefined)?.url });
      return real.call(this, title, options);
    };
  });
  await page.goto("/parametres?section=notifications");
  await expect(page.getByRole("heading", { name: "Notifications", level: 2 })).toBeVisible();
}

/** Les notifications que la page a demandé d'afficher. */
const askedByPage = (page: Page) => page.evaluate(() => (window as unknown as { __shown: Shown[] }).__shown);
/** Celles que le service worker a demandé d'afficher, en réponse à ce qu'il a reçu. */
const askedByWorker = (worker: Worker) => worker.evaluate(() => (self as unknown as { __shown?: Shown[] }).__shown ?? []);

test.describe("Notifications push", () => {
  test("paramètres : on les active sur cet appareil, l'essai arrive, les choix sont gardés, puis on les coupe", async ({ page }) => {
    await openSettings(page);
    // La section est celle de tout le monde, et le menu du compte y mène.
    await expect(page.getByRole("navigation", { name: "Sections des paramètres" }).getByRole("link", { name: "Notifications" })).toHaveAttribute("aria-current", "page");

    // Rien n'est activé d'avance : chaque appareil demande sa permission.
    await expect(page.getByText("Désactivées sur cet appareil.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Appareils qui reçoivent mes notifications" })).toHaveCount(0);
    await page.getByRole("button", { name: "Activer sur cet appareil" }).click();
    await expect(page.getByText("Activées sur cet appareil.", { exact: true })).toBeVisible();
    const devices = page.getByRole("list", { name: "Appareils qui reçoivent mes notifications" }).getByRole("listitem");
    await expect(devices).toHaveCount(1);
    await expect(devices).toContainText("Cet appareil");

    // L'essai : une vraie notification, affichée par le service worker, qui ramène ici.
    await page.getByRole("button", { name: "Envoyer un essai" }).click();
    await expect(page.getByText("Essai envoyé : il arrive dans un instant.")).toBeVisible();
    expect(await askedByPage(page)).toEqual([
      { title: "Tomate HQ", body: "Les notifications fonctionnent sur cet appareil 🍅", tag: "essai", url: "/parametres?section=notifications" },
    ]);

    // Quatre sujets, tous allumés au départ, pour toute l'équipe.
    for (const topic of ["Nouvelle tâche", "Tâche terminée", "Tâche bloquée", "Record à Tomato Tower"]) {
      await expect(page.getByRole("switch", { name: topic })).toBeChecked();
    }
    await expect(page.getByRole("radio", { name: /Toute l'équipe/ })).toBeChecked();
    // Deux choix faits coup sur coup : aucun ne défait l'autre.
    await page.getByRole("switch", { name: "Tâche terminée" }).click();
    await page.getByRole("radio", { name: /Seulement les miennes/ }).check({ force: true });
    await expect(page.getByRole("switch", { name: "Tâche terminée" })).not.toBeChecked();

    // Tout est encore là au rechargement : l'appareil, et les choix.
    await page.reload();
    await expect(page.getByText("Activées sur cet appareil.", { exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Tâche terminée" })).not.toBeChecked();
    await expect(page.getByRole("switch", { name: "Tâche bloquée" })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Seulement les miennes/ })).toBeChecked();

    // Couper : l'appareil quitte la liste, les choix restent pour les autres.
    await page.getByRole("button", { name: "Désactiver" }).click();
    await expect(page.getByText("Désactivées sur cet appareil.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Appareils qui reçoivent mes notifications" })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Tâche terminée" })).not.toBeChecked();
  });

  test("un appareil suit la personne qui s'en sert : le profil suivant le retrouve à son nom", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "Activer sur cet appareil" }).click();
    await expect(page.getByText("Activées sur cet appareil.", { exact: true })).toBeVisible();

    // Maya prend le même navigateur (en démo : « Changer de profil »).
    await page.getByRole("button", { name: /^Compte : Dominic/ }).click();
    await page.getByRole("menuitem", { name: /Changer de profil/ }).click();
    await page.getByRole("menuitem", { name: "Maya Martel" }).click();
    await page.reload();
    await expect(page.getByText("Activées sur cet appareil.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Appareils qui reçoivent mes notifications" }).getByRole("listitem")).toHaveCount(1);

    // Dominic, revenu, ne l'a plus : un appareil n'est qu'à une personne à la fois.
    await page.getByRole("button", { name: /^Compte : Maya/ }).click();
    await page.getByRole("menuitem", { name: /Changer de profil/ }).click();
    await page.getByRole("menuitem", { name: "Dominic Renzetti" }).click();
    await page.goto("/parametres?section=apparence");
    await page.evaluate(() => localStorage.removeItem("__test_push_subscription"));
    await page.goto("/parametres?section=notifications");
    await expect(page.getByText("Désactivées sur cet appareil.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Appareils qui reçoivent mes notifications" })).toHaveCount(0);
  });

  test("le service worker affiche ce qu'il reçoit, et un clic ouvre la tâche dans son projet", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
    // Une tâche de la démo, et l'adresse qu'une notification porterait pour elle.
    const task = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("tthq:demo:db:v2")!) as { tasks: { id: string; title: string; project_id: string; archived_at: string | null }[]; projects: { id: string; slug: string }[] };
      const t = db.tasks.find((x) => !x.archived_at && db.projects.find((p) => p.id === x.project_id)?.slug === "site-web")!;
      return { id: t.id, title: t.title };
    });
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    expect(worker.url()).toMatch(/\/sw\.js$/);

    // Un message arrive (son déchiffrement est l'affaire du navigateur : le worker reçoit le texte en clair).
    const message = { title: "Maya vous confie une tâche", body: `${task.title} · Site Web`, url: `/projets/site-web?tache=${task.id}`, tag: `task_created:${task.id}` };
    await deliver(worker, "push", { json: message });
    expect(await askedByWorker(worker)).toEqual([message]);

    // Un message qui voudrait mener ailleurs, ou qui n'est pas du JSON : affiché quand même, et il reste dans l'application.
    await deliver(worker, "push", { json: { title: "Dehors", body: "…", url: "https://ailleurs.example/", tag: "dehors" } });
    await deliver(worker, "push", { text: "pas du JSON" });
    expect((await askedByWorker(worker)).slice(1)).toEqual([
      { title: "Dehors", body: "…", tag: "dehors", url: "/" },
      { title: "Tomate HQ", body: "pas du JSON", url: "/" },
    ]);

    // Le clic : l'application, déjà ouverte, va au projet et ouvre la tâche, sans se recharger.
    await page.evaluate(() => ((window as unknown as { __same: boolean }).__same = true));
    await deliver(worker, "notificationclick", { url: message.url });
    await expect(page.getByRole("dialog", { name: task.title })).toBeVisible();
    await expect(page).toHaveURL(/\/projets\/site-web$/);
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true);

    // Un clic dont l'adresse voudrait sortir de l'application ne mène qu'à l'accueil.
    await page.keyboard.press("Escape");
    await deliver(worker, "notificationclick", { url: "//ailleurs.example/" });
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });

  test("l'adresse d'une notification ouvre sa tâche au chargement, puis se nettoie", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
    const task = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("tthq:demo:db:v2")!) as { tasks: { id: string; title: string; project_id: string; archived_at: string | null }[]; projects: { id: string; slug: string }[] };
      const t = db.tasks.find((x) => !x.archived_at && db.projects.find((p) => p.id === x.project_id)?.slug === "application")!;
      return { id: t.id, title: t.title };
    });
    await page.goto(`/projets/application?tache=${task.id}`);
    await expect(page.getByRole("dialog", { name: task.title })).toBeVisible();
    await expect(page).toHaveURL(/\/projets\/application$/);
    // Une tâche qui n'existe plus, ou n'importe quoi à la place d'un identifiant : la page s'ouvre, sans panneau.
    await page.goto("/projets/application?tache=00000000-0000-4000-8000-000000000000");
    await expect(page).toHaveURL(/\/projets\/application$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/projets/application?tache=<script>");
    await expect(page.getByRole("heading", { name: "Application" }).first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
