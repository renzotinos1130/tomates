import { expect, test, type Page } from "@playwright/test";
import { memberPortrait } from "../src/lib/avatars";

/** Rows of the structured table that contain `text`. */
const row = (page: Page, text: string) => page.locator('[class*="group/row"]', { hasText: text }).first();
const group = (page: Page, status: string) => page.locator(`section[aria-label="${status}"]`);

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test.describe("Tableau de projet", () => {
  test("ajout rapide, édition en ligne, réorganisation et persistance", async ({ page }) => {
    await page.goto("/projets/application");
    const add = page.getByLabel("Ajouter une tâche (À faire)");
    await add.fill("Tâche créée par le test");
    await add.press("Enter");
    await expect(group(page, "À faire").getByText("Tâche créée par le test")).toBeVisible();

    // Statut, responsable, priorité et échéance se modifient dans le tableau.
    await row(page, "Tâche créée par le test").getByLabel("Statut").click();
    await page.getByRole("menuitem", { name: "En cours" }).click();
    const edited = group(page, "En cours").locator('[class*="group/row"]', { hasText: "Tâche créée par le test" });
    await expect(edited).toBeVisible();
    await edited.getByLabel("Responsable").click();
    await page.getByRole("menuitem", { name: /Maya Martel/ }).click();
    await edited.getByLabel("Priorité").click();
    await page.getByRole("menuitem", { name: "Haute" }).click();
    await edited.getByLabel("Échéance").click();
    await page.getByRole("button", { name: /Demain/ }).click();
    await expect(edited).toContainText("Maya");
    await expect(edited).toContainText("Haute");
    await expect(edited).toContainText("Demain");

    // Glisser-déposer : la première ligne « À faire » passe en troisième position.
    const todo = group(page, "À faire");
    const titles = () => todo.locator("[data-task-title]").allInnerTexts();
    const before = await titles();
    await todo.locator('[class*="group/row"]').first().hover();
    const handle = await todo.getByLabel("Réorganiser").first().boundingBox();
    const target = await todo.locator('[class*="group/row"]').nth(2).boundingBox();
    await drag(
      page,
      { x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2 },
      { x: handle!.x + 20, y: target!.y + target!.height / 2 + 4 },
    );
    await expect.poll(async () => (await titles()).indexOf(before[0])).toBe(2);

    // Tout est encore là après rechargement.
    await page.reload();
    await expect(group(page, "En cours").getByText("Tâche créée par le test")).toBeVisible();
    await expect.poll(async () => (await titles()).indexOf(before[0])).toBe(2);
  });

  test("kanban : une carte change de colonne et le tableau suit", async ({ page }) => {
    await page.goto("/projets/application");
    await page.getByRole("tab", { name: "Kanban" }).click();
    const card = group(page, "À faire").locator('[aria-roledescription="carte de tâche"]').first();
    const title = (await card.locator("p").first().innerText()).trim();
    const from = await card.boundingBox();
    const column = await group(page, "Bloqué").boundingBox();
    await drag(page, { x: from!.x + from!.width / 2, y: from!.y + 20 }, { x: column!.x + column!.width / 2, y: column!.y + 150 });
    await expect(group(page, "Bloqué").getByText(title)).toBeVisible();

    await page.getByRole("tab", { name: "Tableau" }).click();
    await expect(group(page, "Bloqué").getByText(title)).toBeVisible();
  });

  test("filtres, archivage et suppression", async ({ page }) => {
    await page.goto("/projets/site-web");
    await page.getByRole("button", { name: "Filtrer : Maya Martel" }).click();
    const owners = page.locator('section[aria-label] [class*="group/row"] [aria-label="Responsable"]');
    await expect(owners.first()).toBeVisible();
    for (const name of await owners.allInnerTexts()) expect(name).toContain("Maya");
    await page.getByRole("button", { name: /Réinitialiser/ }).click();

    await page.getByRole("button", { name: "Options du projet" }).click();
    await page.getByRole("menuitem", { name: "Archiver les tâches terminées" }).click();
    await page.getByRole("button", { name: /Archivées/ }).click();
    const archived = group(page, "Archivées");
    await expect(archived.getByText("Mettre en place Plausible Analytics")).toBeVisible();

    await archived.getByText("Mettre en place Plausible Analytics").click();
    await page.getByRole("button", { name: "Plus d'actions" }).click();
    await page.getByRole("menuitem", { name: "Supprimer" }).click();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Mettre en place Plausible Analytics")).toHaveCount(0);
  });
});

test.describe("Tâches", () => {
  test("raccourcis clavier et panneau de détail", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();

    await page.keyboard.press("c");
    const title = page.getByLabel("Titre de la tâche");
    await title.fill("Tâche créée au clavier");
    await title.press("Enter");
    await expect(page.getByText("Tâche créée", { exact: true })).toBeVisible();

    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Rechercher une tâche, une page, une action…").fill("créée au clavier");
    await page.getByRole("option", { name: /Tâche créée au clavier/ }).click();

    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Titre de la tâche").fill("Tâche renommée");
    await sheet.getByLabel("Titre de la tâche").press("Enter");
    await sheet.getByRole("button", { name: "Ajouter une sous-tâche" }).click();
    const sub = sheet.getByLabel("Nouvelle sous-tâche");
    await sub.fill("Étape 1");
    await sub.press("Enter");
    await sub.fill("Étape 2");
    await sub.press("Enter");
    await sheet.getByRole("checkbox").nth(1).click();
    await expect(sheet.getByText("1/2")).toBeVisible();

    await sheet.getByLabel("Écrire un commentaire").fill("Premier commentaire");
    await sheet.getByLabel("Écrire un commentaire").press("Control+Enter");
    await expect(sheet.getByText("Premier commentaire")).toBeVisible();
    await expect(sheet.getByText(/a renommé la tâche/)).toBeVisible();
  });

  test("deux onglets restent synchronisés", async ({ context, page }) => {
    await page.goto("/projets/application");
    const other = await context.newPage();
    await other.goto("/projets/application");
    await expect(other.getByLabel("Ajouter une tâche (À faire)")).toBeVisible();

    const add = page.getByLabel("Ajouter une tâche (À faire)");
    await add.fill("Visible dans l'autre onglet");
    await add.press("Enter");
    await expect(group(other, "À faire").getByText("Visible dans l'autre onglet")).toBeVisible();
  });
});

test("Meeting du mercredi : préparation, direct, priorités, clôture, historique", async ({ page }) => {
  await page.goto("/meeting");

  // Avant : on peut déjà noter un point à discuter.
  const topic = page.getByLabel("Ajouter un point à discuter");
  await topic.fill("Valider le prix de lancement");
  await topic.press("Enter");
  await expect(page.getByText("Valider le prix de lancement")).toBeVisible();

  // Pendant : on parcourt un projet, on ajoute une tâche et on l'assigne sans quitter le meeting.
  await page.getByRole("button", { name: /Démarrer le meeting/ }).click();
  await expect(page.getByText("En direct").first()).toBeVisible();
  await page.getByRole("button", { name: /Application/ }).first().click();
  const input = page.getByLabel("Nouvelle tâche pour Application");
  await input.fill("Préparer la démo pour les investisseurs");
  await page.getByRole("button", { name: "Assigner à Maya Martel" }).click();
  await page.getByRole("button", { name: "Priorité de la semaine", exact: true }).click();
  await input.press("Enter");
  await expect(page.getByText("Nouveau").first()).toBeVisible();

  const decision = page.getByLabel("Ajouter une décision");
  await decision.fill("Lancement confirmé pour le 2 décembre");
  await decision.press("Enter");

  // Les priorités non terminées de la semaine dernière restent visibles.
  await page.getByRole("button", { name: /Priorités/ }).first().click();
  await expect(page.getByText("Non terminées la semaine dernière")).toBeVisible();
  await page.getByRole("button", { name: "Tout reconduire" }).click();

  // Après : récapitulatif automatique, conservé dans l'historique.
  await page.getByRole("button", { name: /Clôture/ }).first().click();
  await page.getByRole("button", { name: /Terminer le meeting/ }).click();
  await expect(page.getByText(/Meeting terminé/).first()).toBeVisible();
  await expect(page.getByText("Lancement confirmé pour le 2 décembre").first()).toBeVisible();
  await expect(page.getByText("Préparer la démo pour les investisseurs").first()).toBeVisible();

  await page.getByRole("tab", { name: /Historique/ }).click();
  expect(await page.locator('a[href^="/meeting/"]').count()).toBeGreaterThanOrEqual(4);

  // Les nouvelles priorités apparaissent sur le dashboard.
  await page.goto("/");
  await expect(page.locator(".dash-week").getByText("Préparer la démo pour les investisseurs")).toBeVisible();
});

test("Workflows : canevas interactif, ajout d'étapes et persistance", async ({ page }) => {
  await page.goto("/workflows");
  await page.getByRole("link", { name: "Publication d'un contenu" }).click();
  await expect(page.locator(".wb-node")).toHaveCount(5);

  // Une action de la pile s'ajoute après l'étape sélectionnée et s'enregistre toute seule.
  await page.getByRole("button", { name: /Ajouter « Créer une tâche »/ }).click();
  await expect(page.locator(".wb-node")).toHaveCount(6);
  await expect(page.getByText("Enregistrement…")).toBeVisible();
  await expect(page.getByText("Enregistré automatiquement")).toBeVisible();
  await page.reload();
  await expect(page.locator(".wb-node")).toHaveCount(6);

  // Un nouveau canevas démarre avec un point de départ.
  await page.goto("/workflows");
  await page.getByRole("button", { name: /Nouveau workflow/ }).click();
  await page.getByLabel("Nom").fill("Accueil d'un client");
  await page.getByRole("button", { name: "Créer le workflow" }).click();
  await expect(page.locator(".wb-node")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Accueil d'un client" }).first()).toBeVisible();

  // Modifier une étape puis quitter aussitôt : rien n'est perdu.
  await page.getByRole("button", { name: "Modifier l'étape" }).click();
  await page.getByLabel("Nom de l'étape").fill("Premier contact");
  await page.getByRole("button", { name: "Enregistrer l'étape" }).click();
  await page.getByRole("link", { name: "Retour aux workflows" }).click();
  await page.getByRole("link", { name: "Accueil d'un client" }).click();
  await expect(page.locator(".wb-node").getByText("Premier contact")).toBeVisible();
});

test("Apparence : le verre se règle et le choix est conservé", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();
  const opacity = () =>
    page.evaluate(() => getComputedStyle(document.querySelector(".gw-scope")!).getPropertyValue("--gw-opacity").trim());

  // Par défaut : la ferme de l'équipe, floutée, sous un verre poli resté clair.
  await expect.poll(opacity).toBe("0.5");
  await expect(page.locator('.gw-scope > div[aria-hidden] img[src*="ferme"]')).toHaveCount(1);

  // Le réglage s'ouvre depuis le dashboard (et depuis la navigation, sur tous les écrans).
  // Deux scènes, celles de l'équipe. Un préréglage ajuste le verre ; choisir une scène
  // lui redonne le givre qui lui convient.
  await page.getByRole("button", { name: "Ajuster le verre" }).first().click();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await page.getByRole("button", { name: "Clair" }).click();
  await expect.poll(opacity).toBe("0.34");
  // Le yacht au couchant est plus sombre que les champs : son verre est un peu plus plein.
  await page.getByRole("radio", { name: "Le yacht" }).click();
  await expect.poll(opacity).toBe("0.56");
  await expect(page.locator('.gw-scope > div[aria-hidden] img[src*="yacht"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Opaque" }).click();
  await expect.poll(opacity).toBe("0.86");

  await page.reload();
  await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();
  await expect.poll(opacity).toBe("0.86");
  await expect(page.locator('.gw-scope > div[aria-hidden] img[src*="yacht"]')).toHaveCount(1);
});

test("Navigation : un rail qui s'ouvre sous la souris, s'épingle, et un menu plein écran sur téléphone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  // Où commence le contenu (la feuille, ou les tuiles du dashboard qui n'en ont pas).
  const windowLeft = () =>
    page.locator("#app-scroll").evaluate((el) => Math.round(el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft)));
  const away = () => page.mouse.move(900, 500);

  // Au repos : un rail d'icônes. Chaque entrée garde son nom, les messages non lus ont leur point.
  await away();
  await expect(nav).toHaveAttribute("data-collapsed", "true");
  await expect(nav.getByRole("link", { name: /^Messages \(\d+ non lus?\)$/ })).toBeVisible();
  const beside = await windowLeft();

  // Un glissement qui passe dessus (bouton enfoncé) ne l'ouvre pas ; le bouton relâché, la souris l'ouvre.
  await page.mouse.move(700, 880);
  await page.mouse.down();
  await page.mouse.move(40, 880, { steps: 8 });
  await page.waitForTimeout(400);
  await expect(nav).toHaveAttribute("data-collapsed", "true");
  await page.mouse.up();
  await away();

  // La souris l'ouvre par-dessus la fenêtre, qui ne bouge pas ; il se referme quand elle repart.
  await nav.hover();
  await expect(nav).toHaveAttribute("data-collapsed", "false");
  await expect(nav.getByText("Espace de travail")).toBeVisible();
  expect(await windowLeft()).toBe(beside);
  await away();
  await expect(nav).toHaveAttribute("data-collapsed", "true");

  // Choisir une destination le referme aussitôt : l'écran demandé n'est pas couvert,
  // et aucune infobulle ne reste accrochée au rail (ni celle de l'entrée choisie, ni
  // celle de l'icône sur laquelle la souris est arrivée).
  for (const [name, url] of [[/Mes tâches/, /\/mes-taches/], [/^Workflows/, /\/workflows/]] as const) {
    await away();
    await page.mouse.move(34, 300, { steps: 6 });
    await expect(nav).toHaveAttribute("data-collapsed", "false");
    await page.waitForTimeout(450);
    await nav.getByRole("link", { name }).hover();
    await page.waitForTimeout(450);
    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL(url);
    await expect(nav).toHaveAttribute("data-collapsed", "true");
    await page.waitForTimeout(500);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }

  // Un de ses menus ouvert le retient, même quand la souris s'éloigne.
  await away();
  await nav.hover();
  await expect(nav).toHaveAttribute("data-collapsed", "false");
  await nav.getByRole("button", { name: /Dominic Renzetti/ }).click();
  await expect(page.getByRole("menuitem", { name: "Mon profil" })).toBeVisible();
  await page.mouse.move(900, 200);
  await page.waitForTimeout(600);
  // (Un menu ouvert masque le reste de la page aux lecteurs d'écran : on vise l'élément, pas son rôle.)
  await expect(page.locator('nav[aria-label="Navigation principale"]')).toHaveAttribute("data-collapsed", "false");
  await page.keyboard.press("Escape");
  await expect(nav).toHaveAttribute("data-collapsed", "true");

  // Épinglé, il reste ouvert et la fenêtre lui fait place ; le choix survit au rechargement.
  await nav.hover();
  await expect(nav).toHaveAttribute("data-collapsed", "false");
  await nav.getByRole("button", { name: "Garder le menu ouvert" }).click();
  await away();
  await page.waitForTimeout(600);
  await expect(nav).toHaveAttribute("data-collapsed", "false");
  await expect.poll(windowLeft).toBeGreaterThan(beside + 150);
  await page.reload();
  await expect(nav).toHaveAttribute("data-collapsed", "false");

  // Relâché, il redevient un rail tout de suite, même avec la souris encore dessus.
  await nav.getByRole("button", { name: "Garder le menu ouvert" }).click();
  await expect(nav).toHaveAttribute("data-collapsed", "true");
  await expect.poll(windowLeft).toBe(beside);

  // Téléphone : un bouton, le menu en plein écran, et il se referme en naviguant.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const menu = page.getByRole("dialog", { name: "Navigation" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Fermer le menu" })).toHaveAttribute("aria-expanded", "true");
  await menu.getByRole("link", { name: "Workflows" }).click();
  await expect(page).toHaveURL(/\/workflows/);
  await expect(menu).toBeHidden();
});

test.describe("Équipe et petites joies", () => {
  test("chacun a son portrait : à côté du « Bonjour » et dans l'équipe", async ({ page }) => {
    await page.goto("/");
    const greeting = page.locator("header").filter({ has: page.getByRole("heading", { name: /^(Bonjour|Bonsoir|Bonne nuit), Dominic\.$/ }) });
    const portrait = greeting.locator('img[src$="/avatars/dominic-renzetti.webp"]');
    await expect(portrait).toBeVisible();
    // L'image est bien servie et décodée, pas seulement référencée.
    await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))).toBe(256);

    // Les six partenaires, chacun avec le sien.
    await page.goto("/equipe");
    for (const slug of ["alexandre-halle", "dominic-renzetti", "marco-drouin", "maya-martel", "antoine-favreau", "jimmy-perreault"]) {
      await expect(page.getByRole("main").locator(`img[src$="/avatars/${slug}.webp"]`).first()).toBeVisible();
    }
  });

  test("un portrait se retrouve par le nom complet, ou par le prénom quand le profil n'a que lui", () => {
    const of = (full_name: string, avatar_url: string | null = null) => memberPortrait({ full_name, avatar_url });
    expect(of("  maya   MARTEL ")).toBe("/avatars/maya-martel.webp");
    // Un compte créé par invitation s'appelle d'abord comme son adresse.
    expect(of("Dominic")).toBe("/avatars/dominic-renzetti.webp");
    // Un homonyme de prénom garde ses initiales ; une photo de profil passe avant tout.
    expect(of("Marco Rossi")).toBeNull();
    expect(of("Zoé Exemple")).toBeNull();
    expect(of("Jimmy Perreault", "https://exemple.test/jimmy.png")).toBe("https://exemple.test/jimmy.png");
  });

  /** Ouvre le détail d'une tâche : sa case y reste en place, terminée ou non. */
  const openTask = async (page: Page, title: string) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Rechercher une tâche, une page, une action…").fill(title);
    await page.getByRole("option", { name: new RegExp(title) }).click();
    return page.getByRole("dialog");
  };

  test("terminer une tâche fait tomber quelques tomates ; la rouvrir, non", async ({ page }) => {
    const sheet = await openTask(page, "Intégrer les notifications push");
    const drops = page.locator(".tomato-rain .tomato-drop");
    await expect(drops).toHaveCount(0);

    await sheet.getByRole("checkbox", { name: "Marquer comme terminée" }).click();
    await expect(drops.first()).toBeAttached();
    expect(await drops.count()).toBeGreaterThanOrEqual(8);
    // Elles ne prennent aucun clic, et l'averse s'en va d'elle-même.
    await expect(page.locator(".tomato-rain")).toHaveCSS("pointer-events", "none");
    await expect(page.locator(".tomato-rain")).toHaveCount(0, { timeout: 6000 });

    await sheet.getByRole("checkbox", { name: "Rouvrir la tâche" }).click();
    await expect(sheet.getByRole("checkbox", { name: "Marquer comme terminée" })).toBeVisible();
    await page.waitForTimeout(400);
    await expect(drops).toHaveCount(0);
  });

  test("avec « moins de mouvement », pas d'averse", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const sheet = await openTask(page, "Intégrer les notifications push");
    await sheet.getByRole("checkbox", { name: "Marquer comme terminée" }).click();
    await expect(sheet.getByRole("checkbox", { name: "Rouvrir la tâche" })).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.locator(".tomato-drop")).toHaveCount(0);
  });
});

test.describe("Dashboard", () => {
  /**
   * Ce que disent les tuiles dépend du jour : un jeudi matin, le meeting d'hier est clos, le
   * prochain est dans six jours, et ce qui a été terminé ce matin compte pour la semaine en cours.
   */
  const THURSDAY = new Date("2026-11-12T10:12:00-05:00");
  /** The greeting: the one first-level heading of the page. */
  const hello = (page: Page) => page.getByRole("heading", { name: /Dominic/, level: 1 });
  const arrive = async (page: Page) => {
    await page.goto("/");
    await expect(hello(page)).toBeVisible();
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
  };

  test("à l'arrivée : la scène seule avec le préchargeur, puis l'application par-dessus", async ({ page }) => {
    const started = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    const styleOf = (selector: string, property: "opacity" | "visibility") =>
      page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el)[prop], property);

    const sceneFilter = () => page.locator(".gw-scene img").evaluate((el) => getComputedStyle(el).filter);
    const sceneVeil = () => page.locator(".gw-scene").evaluate((el) => getComputedStyle(el, "::after").opacity);

    // La ferme est en pleine vue, nette : ni navigation ni contenu tant que la tomate saute sur sa plaque.
    await expect(page.locator(".preloader .preloader-plate")).toBeVisible();
    await expect(page.locator('.gw-scope > div[aria-hidden] img[src*="ferme"]')).toBeVisible();
    // (Lus en attendant qu'ils soient vrais : la feuille de style peut arriver un instant après le HTML.)
    await expect.poll(sceneVeil).toBe("0");
    expect(await sceneFilter()).toBe("none");
    await expect.poll(() => styleOf('nav[aria-label="Navigation principale"]', "opacity")).toBe("0");
    await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeHidden();

    // Elle prend son temps (la chute et deux tours de saut), puis la plaque s'en va, l'image
    // reste, et l'application arrive dessus.
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 15000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(3250);
    await expect.poll(() => styleOf('nav[aria-label="Navigation principale"]', "opacity")).toBe("1");
    await expect(page.locator('.gw-scope > div[aria-hidden] img[src*="ferme"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: /Dominic/, level: 1 })).toBeVisible();
    // Le givre est sur la photo, pas dans le verre : elle se floute et pâlit sous un voile
    // blanc quand l'application arrive.
    await expect.poll(sceneFilter).toContain("blur(18px)");
    await expect.poll(sceneVeil).toBe("0.4");
  });

  test("jamais de verre sur du verre : la page est posée sur l'image, les autres écrans sur une seule feuille", async ({ page }) => {
    await page.goto("/");
    await expect(hello(page)).toBeVisible();
    const blurOf = (selector: string) =>
      page.locator(selector).first().evaluate((el) => getComputedStyle(el).backdropFilter);

    // Dashboard : pas de feuille derrière la page ; chaque tuile est le verre, et aucune n'en contient une autre.
    // Le verre est clair : c'est la photo, derrière, qui est floutée.
    await expect(page.locator(".app-window")).toHaveCount(0);
    expect(await blurOf("main .gw-panel")).toBe("none");
    expect(await page.evaluate(() => document.querySelectorAll("main .gw-panel .gw-panel").length)).toBe(0);
    // La salutation, elle, n'est dans aucune tuile : elle est écrite sur l'image.
    expect(await hello(page).evaluate((el) => !!el.closest(".gw-panel, .gw-glass"))).toBe(false);

    // Un autre écran : une seule feuille, et ses panneaux n'en sont que des zones.
    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: "Messages", exact: true }).click();
    await expect(page).toHaveURL(/\/messages/);
    await expect(page.locator(".app-window")).toHaveCount(1);
    expect(await blurOf('nav[aria-label="Conversations"]')).toBe("none");

    // Et retour : la feuille s'efface de nouveau.
    await page.goBack();
    await expect(hello(page)).toBeVisible();
    await expect(page.locator(".app-window")).toHaveCount(0);
  });

  test("la page a la hauteur du menu, et le même écart que les autres écrans", async ({ page }) => {
    const frame = () =>
      page.evaluate(() => {
        const nav = document.querySelector(".nav-glass")!.getBoundingClientRect();
        const main = document.querySelector("main")!.getBoundingClientRect();
        const tiles = [...document.querySelectorAll("main .gw-panel")].map((el) => el.getBoundingClientRect());
        const scroller = document.getElementById("app-scroll")!;
        return {
          nav: { top: nav.top, bottom: nav.bottom, right: nav.right },
          page: {
            top: main.top,
            bottom: Math.max(...tiles.map((t) => t.bottom)),
            left: Math.min(...tiles.map((t) => t.left)),
            right: Math.max(...tiles.map((t) => t.right)),
          },
          width: window.innerWidth,
          overflow: scroller.scrollHeight - scroller.clientHeight,
        };
      });
    const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

    // Grand écran : la page prend toute la hauteur, elle commence et finit avec le menu.
    await page.setViewportSize({ width: 1920, height: 1273 });
    await arrive(page);
    await page.waitForTimeout(900);
    const tall = await frame();
    expect(tall.overflow).toBe(0);
    near(tall.page.top, tall.nav.top);
    near(tall.page.bottom, tall.nav.bottom);
    // Le même écart à gauche (avec le menu) qu'à droite (avec le bord de l'écran).
    near(tall.page.left - tall.nav.right, 14);
    near(tall.width - tall.page.right, 14);

    // Un autre écran : sa feuille occupe exactement la même place.
    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: "Messages", exact: true }).click();
    await expect(page.locator(".app-window")).toHaveCount(1);
    await page.waitForTimeout(600);
    const sheet = (await page.locator(".app-window").boundingBox())!;
    near(sheet.x, tall.page.left);
    near(sheet.x + sheet.width, tall.page.right);
    near(sheet.y, tall.nav.top);
    near(sheet.y + sheet.height, tall.nav.bottom);
    await page.goBack();
    await expect(hello(page)).toBeVisible();

    // Écran plus court : la page dépasse et défile ; elle part du haut du menu et finit à son bas.
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.waitForTimeout(600);
    const short = await frame();
    expect(short.overflow).toBeGreaterThan(0);
    near(short.page.top, short.nav.top);
    await page.locator("#app-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(300);
    const end = await frame();
    near(end.page.bottom, end.nav.bottom);
  });

  test("une page en trois bandes qui ne se ressemblent pas : la salutation, l'équipe, le pied", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await arrive(page);
    await page.waitForTimeout(1200);
    const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;
    const edge = (b: { y: number; height: number }) => Math.round(b.y + b.height);
    const near = (a: number, b: number) => expect(Math.abs(Math.round(a) - Math.round(b))).toBeLessThanOrEqual(1);

    // 1. La salutation : très grande, à côté d'un grand portrait. Rien d'autre sur la page n'est aussi gros.
    const size = (selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size("main h1")).toBeGreaterThanOrEqual(72);
    expect(await size("main h1")).toBeGreaterThan((await size(".dash-title")) * 2);
    const portrait = await box('header img[src$="/avatars/dominic-renzetti.webp"]');
    expect(portrait.width).toBeGreaterThanOrEqual(110);
    // Elle se tient un peu à l'écart du menu : le portrait n'est pas collé au rail.
    const rail = await box(".nav-glass");
    expect(portrait.x - (rail.x + rail.width)).toBeGreaterThanOrEqual(48);

    // 2. L'équipe, en alignement : la tomate de la semaine puis une carte par partenaire, sur
    //    une rangée. La carte du score est plus large ; chaque tête dépasse de sa carte.
    const cards = page.locator(".lineup > .lineup-card");
    await expect(cards).toHaveCount(7);
    const boxes = await Promise.all(Array.from({ length: 7 }, async (_, i) => (await cards.nth(i).boundingBox())!));
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
    expect(Math.max(...boxes.map(edge)) - Math.min(...boxes.map(edge))).toBeLessThanOrEqual(1);
    expect(boxes[0].width).toBeGreaterThan(boxes[1].width * 1.15);
    expect(new Set(boxes.slice(1).map((b) => Math.round(b.width))).size).toBeLessThanOrEqual(2);
    for (let i = 0; i < 7; i++) {
      const head = (await cards.nth(i).locator(".lineup-head").boundingBox())!;
      expect(head.width).toBeGreaterThanOrEqual(80);
      // À cheval sur le bord du haut : la moitié au-dessus de la carte.
      near(head.y + head.height / 2, boxes[i].y);
    }
    await expect(cards.nth(0).locator("svg.lineup-mascot")).toBeVisible();
    // Les six prénoms sont sur une même ligne : la pastille « vous » ne décale pas ma carte.
    const names = await page.locator(".lineup-card h3").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().bottom)));
    expect(names).toHaveLength(6);
    expect(new Set(names).size).toBe(1);
    for (const slug of ["alexandre-halle", "antoine-favreau", "dominic-renzetti", "jimmy-perreault", "marco-drouin", "maya-martel"]) {
      await expect(page.locator(`.lineup img[src$="/avatars/${slug}.webp"]`)).toBeVisible();
    }

    // 3. Le pied : trois choses de formes différentes — le billet du meeting (sa souche tomate),
    //    les projets en grands pourcentages, l'activité. Elles commencent et finissent ensemble.
    const [meet, proj, feed] = await Promise.all([".dash-foot > .ticket", ".dash-foot > section[aria-labelledby='dashboard-projects']", ".dash-foot > section:last-child"].map(box));
    for (const b of [proj, feed]) {
      near(b.y, meet.y);
      near(edge(b), edge(meet));
    }
    expect(proj.width).toBeGreaterThan(meet.width * 1.6);
    await expect(page.locator(".ticket-stub")).toHaveCSS("background-color", "rgb(204, 51, 32)");
    expect(await size(".project-figure")).toBeGreaterThanOrEqual(40);

    // L'activité remplit sa tuile avec des lignes entières ; celles qui n'ont pas la place sont hors du parcours clavier.
    const fill = await page.locator(".dash-foot .gw-rows.gw-fit").evaluate((el) => {
      const rows = [...el.children] as HTMLElement[];
      const shown = rows.filter((r) => !r.inert);
      const last = shown[shown.length - 1].getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      return { shown: shown.length, gap: Math.round(frame.bottom - last.bottom), inside: shown.every((r) => r.getBoundingClientRect().bottom <= frame.bottom + 1) };
    });
    expect(fill.shown).toBeGreaterThanOrEqual(2);
    expect(fill.inside).toBe(true);
    expect(fill.gap).toBeLessThanOrEqual(8);
  });

  test("la semaine de l'équipe en trois onglets : priorités (un potager), à débloquer, terminées", async ({ page }) => {
    await page.clock.install({ time: THURSDAY });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await arrive(page);

    const week = page.locator(".dash-week");
    const score = week.locator(".lineup-score");
    const figure = score.locator('[data-state="active"] .gw-figure').first();
    const card = (name: string) => week.locator(".lineup-card", { has: page.getByRole("heading", { name, exact: true }) });
    const height = async () => Math.round((await week.boundingBox())!.height);

    // Les trois onglets portent leur compte : la page les dit sans un clic.
    await expect(week.getByRole("tab")).toHaveText(["Priorités10", "À débloquer4", "Terminées2"]);
    await expect(week.getByRole("tab", { name: /^Priorités/ })).toHaveAttribute("aria-selected", "true");

    // Priorités : le score en très grand, et le potager — dix priorités, dix tomates, chacune
    // nommée par sa tâche et son statut. Chaque carte porte celles de son partenaire.
    await expect(figure).toHaveText("1");
    await expect(score).toContainText("/10");
    expect(await figure.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(68);
    await expect(score.locator(".potager button")).toHaveCount(10);
    await expect(score.getByRole("button", { name: "Intégrer le formulaire de contact avec validation : Terminé, Alexandre" })).toBeVisible();
    await expect(score.locator('[data-state="active"] .week-legend')).toContainText("2 bloquées");
    await expect(card("Alexandre").getByRole("button", { name: "Finaliser le parcours d'inscription : En cours" })).toBeVisible();
    await expect(card("Marco").getByRole("button", { name: /^Corriger le crash au démarrage sur Android 14 : Bloqué/ })).toBeVisible();
    await expect(card("Jimmy")).toContainText("Pas de priorité cette semaine.");
    // Au pied de chaque carte, la charge : un segment par statut, que le survol nomme.
    await card("Marco").getByRole("img", { name: "Charge : 1 en validation, 1 bloquée, 2 à faire" }).hover();
    await expect(page.getByRole("tooltip")).toHaveText(/1 en validation.*1 bloquée.*2 à faire/);
    const tall = await height();

    // À débloquer : le chiffre (le seul en rouge), ce dont il est fait, et à qui ça revient. Rien ne bouge.
    await week.getByRole("tab", { name: /^À débloquer/ }).click();
    await expect(figure).toHaveText("4");
    await expect(figure).toHaveCSS("color", "rgb(167, 40, 24)");
    await expect(score.locator('[data-state="active"] .week-legend')).toHaveText(/3 bloquées.*1 en retard/);
    await expect(card("Jimmy").getByRole("button", { name: /^Photos de l'équipe pour le site/ })).toBeVisible();
    await expect(card("Maya")).toContainText("Rien ne coince.");
    await expect(card("Alexandre").getByRole("button", { name: /^Finaliser le parcours/ })).toBeHidden();
    await expect(score.locator(".potager")).toBeHidden();
    expect(await height()).toBe(tall);

    // Terminées : le chiffre de la semaine, six semaines en barres, et qui a terminé quoi.
    // Au clavier, les flèches passent d'un onglet à l'autre.
    await page.keyboard.press("ArrowRight");
    await expect(week.getByRole("tab", { name: /^Terminées/ })).toHaveAttribute("aria-selected", "true");
    await expect(week.getByRole("tab", { name: /^Terminées/ })).toBeFocused();
    await expect(figure).toHaveText("2");
    await expect(score.locator('[data-state="active"] .week-bars li')).toHaveCount(6);
    await expect(card("Marco").getByRole("button", { name: /^Créer la page TikTok de Prospero/ })).toBeVisible();
    expect(await height()).toBe(tall);
    await page.keyboard.press("Home");
    await expect(week.getByRole("tab", { name: /^Priorités/ })).toHaveAttribute("aria-selected", "true");

    // Changer un statut (ici depuis « À prendre en premier ») fait mûrir la tomate, et les comptes suivent partout.
    const first = page.getByRole("region", { name: "À prendre en premier" });
    const line = first.locator('[class*="group/line"]', { hasText: "Audit d'accessibilité" });
    await line.getByRole("button", { name: /^Statut : En cours/ }).click();
    await page.getByRole("menuitem", { name: "Terminé" }).click();
    await expect(score.getByRole("button", { name: /^Audit d'accessibilité \(contraste, navigation clavier\) : Terminé/ })).toBeVisible();
    await expect(figure).toHaveText("2");
    await expect(score.locator('[data-state="active"] .week-legend')).toContainText("2 terminées");
    await expect(week.getByRole("tab", { name: /^Terminées/ })).toHaveText("Terminées3");
    await expect(page.locator(".tomato-rain .tomato-drop").first()).toBeAttached();

    // Une tâche d'une carte s'ouvre d'un clic ; une tomate du potager aussi.
    await card("Maya").getByRole("button", { name: /^Refonte de la page d'accueil/ }).click();
    await expect(page.getByRole("dialog").getByText("Refonte de la page d'accueil").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await score.getByRole("button", { name: /^Calendrier éditorial de décembre : En cours/ }).click();
    await expect(page.getByRole("dialog").getByText("Calendrier éditorial de décembre").first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("la salutation dit où j'en suis, et les actions sont à portée de main", async ({ page }) => {
    await page.clock.install({ time: THURSDAY });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await arrive(page);
    const hero = page.locator("header.dash-hero");

    // Une phrase, pas un tableau : combien de tâches, dont combien de priorités, et ce qui coince.
    await expect(hero).toContainText("5 tâches ouvertes, dont 2 priorités de la semaine · 1 bloquée");
    // Les trois tâches à prendre en premier, priorités d'abord.
    const first = page.getByRole("region", { name: "À prendre en premier" });
    await expect(first.locator('[class*="group/line"]')).toHaveCount(3);
    await expect(first.locator('[class*="group/line"]').first()).toContainText("Partenariat avec 3 créateurs locaux");

    // L'action principale de la page, puis le chemin vers le reste de mes tâches.
    await hero.getByRole("button", { name: "Nouvelle tâche" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Les projets mènent avec leur pourcentage (il compte depuis zéro à l'arrivée, puis s'arrête sur la valeur).
    const project = page.locator(".project-col", { hasText: "Application" });
    await expect(project.locator(".gw-figure")).toHaveText("31");
    await expect(project.getByRole("progressbar", { name: "4 tâches terminées sur 13" })).toBeVisible();
    // Sous la barre, ce qui reste, en entier : sur une colonne étroite la ligne passe à la suivante
    // au lieu d'être coupée, et les barres des trois projets restent au même niveau.
    await expect(project).toContainText("4 sur 13");
    expect(await project.locator(".dot-list > *").allTextContents()).toEqual(["9 ouvertes", "1 bloquée", "1 en retard"]);
    const bars = await page.locator(".project-col .project-bar").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(bars).toHaveLength(3);
    expect(new Set(bars).size).toBe(1);
    const cut = await page.locator(".project-col").evaluateAll((cols) => cols.filter((col) => [...col.querySelectorAll("*")].some((el) => el.scrollWidth > el.clientWidth + 1)).length);
    expect(cut).toBe(0);

    // Un visage mène aux tâches de la personne.
    await page.locator(".lineup").getByRole("link", { name: /^Maya Martel : 3 tâches ouvertes/ }).click();
    await expect(page).toHaveURL(/\/mes-taches\?membre=/);
    await expect(page.getByRole("heading", { name: "Tâches de Maya" })).toBeVisible();
    await page.goBack();
    await hero.getByRole("link", { name: "Mes tâches" }).click();
    await expect(page).toHaveURL(/\/mes-taches$/);
  });

  test("le meeting est un billet : sa date sur la souche, le compte à rebours, puis l'horloge quand il est en direct", async ({ page }) => {
    await page.clock.install({ time: THURSDAY });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await arrive(page);
    const ticket = page.locator(".dash-foot .ticket");
    const face = () => ticket.evaluate((el) => getComputedStyle(el).backgroundImage);

    // Avant : sa date, dans combien de jours, et de quoi on parlera.
    await expect(ticket.locator(".ticket-stub")).toHaveText(/mer\s*18\s*nov/);
    await expect(ticket.locator(".ticket-when")).toHaveText("Dans 6 jours");
    await expect(ticket).toContainText("À discuter · 5");
    await expect(ticket).toContainText("Embaucher un pigiste pour le montage vidéo ?");
    const light = await face();

    // On le démarre : le billet devient sombre (le sombre veut dire « en direct ») et montre l'horloge.
    await ticket.getByRole("link", { name: "Préparer le meeting" }).click();
    await expect(page).toHaveURL(/\/meeting$/);
    await page.getByRole("button", { name: /Démarrer le meeting/ }).click();
    await expect(page.getByText("En direct").first()).toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: "Dashboard", exact: true }).click();
    await expect(hello(page)).toBeVisible();
    await expect(ticket).toContainText("En direct");
    await expect(ticket.locator(".meeting-clock")).toHaveText(/^\d{2}:\d{2}$/);
    expect(await face()).not.toBe(light);
    await expect(ticket).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(ticket.getByRole("link", { name: "Rejoindre le meeting" })).toBeVisible();
  });
});
