import { expect, test, type Page } from "@playwright/test";
import { advance, begin, dropTeamCrate, freeze, openArcade, play, points, resumed, tower, webgl } from "./arcade-drive";

/**
 * TOMATO TOWER, joué pour de vrai dans le navigateur (démo : le « serveur » du jeu est dans la
 * page, avec les mêmes règles). Les parties sont jouées au tick près (voir arcade-drive.ts) et
 * comparées à ce que comptent les règles. La base réelle (scores recomptés par le serveur, tour
 * d'équipe posée d'un seul geste) a ses propres tests : supabase/tests/database/tower.test.sql.
 *
 * Données de démo, vues par Dominic : cette semaine Maya 9 800, Alexandre 7 400, Marco 5 200,
 * Antoine 3 100, Jimmy 1 900 ; son propre record, de la semaine passée, 2 600 ; Marco a gagné la
 * semaine passée (12 400) et porte la couronne. La tour d'équipe en est à 11 caisses.
 */

test.use(webgl);
// La scène est calculée sans carte graphique, et certains scénarios rechargent l'app plusieurs fois.
test.describe.configure({ timeout: 150_000 });

/** Un mercredi matin, à Montréal. */
const WEDNESDAY = new Date("2026-11-11T10:12:00-05:00");

const score = (page: Page) => page.getByTestId("tower-score");
const floors = (page: Page) => page.getByTestId("tower-floors");
const chase = (page: Page) => page.getByTestId("tower-chase");
const over = (page: Page) => page.getByRole("dialog", { name: "Partie terminée" });

async function start(page: Page, at = WEDNESDAY) {
  await page.clock.install({ time: at });
  await openArcade(page);
  await freeze(page);
}

async function playNow(page: Page) {
  await page.getByRole("button", { name: "PLAY NOW" }).click();
  return begin(page);
}

/**
 * Un lien du menu. Le menu s'ouvre au survol : on le laisse s'ouvrir avant de cliquer, comme on
 * le fait à la main.
 */
async function viaMenu(page: Page, name: string) {
  const link = page.getByRole("link", { name });
  await link.hover();
  await page.waitForTimeout(450);
  await link.click();
}

/** La fin d'une partie : la chute se regarde un instant, puis le résultat arrive. */
async function result(page: Page) {
  await page.clock.runFor(1200);
  await expect(tower(page)).toHaveAttribute("data-screen", "over");
  return over(page);
}

test.describe("Tomato Tower", () => {
  test("l'accueil du jeu : le titre, mon record, le champion, la remise à zéro", async ({ page }) => {
    await page.clock.install({ time: WEDNESDAY });
    // On y arrive par le menu.
    await page.goto("/");
    await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 20000 });
    await viaMenu(page, "Tomato Tower");
    await expect(page).toHaveURL(/\/arcade$/);
    await expect(page.locator(".tower-stage")).toHaveAttribute("data-state", "ready", { timeout: 30000 });

    await expect(page.getByRole("heading", { name: "Tomato Tower", level: 1 })).toBeAttached();
    await expect(page.getByText("Stack it. Grow it. Own it.")).toBeVisible();
    await expect(page.getByRole("button", { name: "PLAY NOW" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "TEAM TOWER" })).toBeEnabled();
    const home = page.locator(".tower-home");
    await expect(home).toContainText(/Mon record\s*2\s600\s*10 étages/);
    // Du mercredi 10 h 12 au lundi 0 h : quatre jours et treize heures.
    await expect(home).toContainText(/Remise à zéro\s*dans 4 j 13 h/);
    await expect(home).toContainText("Marco porte la couronne");
    await expect(home).toContainText(/Champion de la semaine du 2 nov · 12\s400/);
    // Le haut du classement de la semaine, et la couronne sur le visage du champion.
    await expect(home.getByRole("listitem")).toHaveText([/1\s*Maya\s*9\s800/, /2\s*Alexandre\s*7\s400/, /3\s*Marco\s*5\s200/, /4\s*Antoine\s*3\s100/]);
    await expect(home.locator('[aria-label="Marco Drouin"] .tower-crown:visible').first()).toBeVisible();
    await expect(home.locator('[aria-label="Maya Martel"] .tower-crown')).toHaveCount(0);
  });

  test("une partie : parfaits, combo, coupe, bonus, raté ; le score est celui des règles, et il est enregistré", async ({ page }) => {
    await start(page);
    const run = await playNow(page);
    await expect(score(page)).toHaveText("0");
    await expect(floors(page)).toHaveText("Étage 0");
    // Le score à battre : le plus proche au-dessus du mien.
    await expect(chase(page)).toHaveText(/Plus que 1\s900 points pour battre Jimmy !/);
    // Avant la première caisse, le jeu dit comment la lâcher.
    await expect(page.getByTestId("tower-hint")).toHaveText(/Espace ou un clic : lâcher la caisse/);

    // Trois parfaits : 200, puis x2, puis x3.
    await play(page, run, ["p"]);
    await expect(score(page)).toHaveText("200");
    await expect(page.getByTestId("tower-hint")).toHaveCount(0);
    await expect(page.getByTestId("tower-combo")).toHaveCount(0);
    await play(page, run, ["p"]);
    await expect(score(page)).toHaveText("600");
    await expect(page.getByTestId("tower-combo")).toHaveText("x2 COMBO");
    await play(page, run, ["p"]);
    await expect(score(page)).toHaveText(points(1200));
    await expect(page.getByTestId("tower-combo")).toHaveText("x3 COMBO");
    await expect(floors(page)).toHaveText("Étage 3");
    await expect(chase(page)).toHaveText(/Plus que 700 points pour battre Jimmy !/);

    // De travers : 100 points, ce qui dépasse tombe, le combo aussi.
    await play(page, run, ["c"]);
    await expect(score(page)).toHaveText(points(1300));
    await expect(page.getByTestId("tower-combo")).toHaveCount(0);
    const { top } = run.state;
    expect((top.x1 - top.x0) * (top.z1 - top.z0), "la caisse suivante est plus petite").toBeLessThan(3000 * 3000);

    // Onze parfaits de suite : le multiplicateur plafonne à x5, et le dixième étage rapporte son bonus.
    await play(page, run, ["p", "p", "p", "p", "p", "p"]);
    await expect(floors(page)).toHaveText("Étage 10");
    await expect(score(page)).toHaveText(points(1300 + 200 + 400 + 600 + 800 + 1000 + 1000 + 1000));
    await expect(page.locator(".tower-stage")).toHaveAttribute("data-zone", "1");
    await play(page, run, ["p", "p", "p", "p", "p"]);
    await expect(page.getByTestId("tower-combo")).toHaveText("x5 COMBO");
    expect(run.state.score).toBe(11300);
    await expect(score(page)).toHaveText(points(11300));
    // Plus personne devant cette semaine.
    await expect(chase(page)).toHaveText("KING OF TOMATOES 👑");

    // À côté : la partie est finie, tout de suite.
    await play(page, run, ["m"]);
    expect(run.state.over).toBe(true);
    await expect(tower(page)).toHaveAttribute("data-phase", "over");
    const card = await result(page);
    await expect(card.getByTestId("tower-final")).toHaveText(points(11300));
    await expect(card.getByTestId("tower-line")).toHaveText("KING OF TOMATOES 👑");
    await expect(card).toContainText("NOUVEAU RECORD");
    await expect(card).toContainText(/Étages\s*15/);
    await expect(card).toContainText(/Combo\s*x5/);
    await expect(card).toContainText(/Semaine\s*1er/);
    await expect(card).toContainText(/Votre ancien record était de 2\s600\./);

    // Le classement : me voilà premier de la semaine, deuxième de tous les temps.
    await card.getByRole("button", { name: "LEADERBOARD" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(page.getByRole("tab", { name: "THIS WEEK" })).toHaveAttribute("aria-selected", "true");
    await expect(panel.locator("ol").first().getByRole("listitem").first()).toContainText(/1\s*Dominic Renzetti\s*vous\s*15 étages · combo x5 · 1 partie\s*11\s300/);
    await expect(panel.locator("ol").first().getByRole("listitem").nth(1)).toContainText(/2\s*Maya Martel/);
    await page.getByRole("tab", { name: "ALL TIME" }).click();
    await expect(panel.getByRole("listitem").first()).toContainText(/Marco Drouin.*12\s400/);
    await expect(panel.getByRole("listitem").nth(1)).toContainText(/Dominic Renzetti.*2 parties\s*11\s300/);
    await page.getByRole("tab", { name: "MY STATS" }).click();
    await expect(panel).toContainText(/Record\s*11\s300\s*15 étages/);
    await expect(panel).toContainText(/Cette semaine\s*1er/);
    await expect(panel).toContainText(/Parties\s*2/);
    await expect(panel).toContainText(/Étages posés\s*25\s*17 parfaits/);

    // Et c'est encore là au rechargement.
    await page.clock.resume();
    await openArcade(page);
    await expect(page.locator(".tower-home")).toContainText(/Mon record\s*11\s300\s*15 étages/);
    await expect(page.locator(".tower-home").getByRole("listitem").first()).toHaveText(/1\s*Dominic\s*11\s300/);
  });

  test("PLAY AGAIN relance une partie neuve sans recharger ; une partie sans caisse posée ne compte pas", async ({ page }) => {
    await start(page);
    const first = await playNow(page);
    await play(page, first, ["c", "c", "m"]);
    const card = await result(page);
    await expect(card.getByTestId("tower-final")).toHaveText("200");
    // 200 points : derrière les cinq autres. Une des phrases du jeu accompagne le résultat.
    await expect(card).toContainText(/Semaine\s*6e/);
    await expect(card.getByTestId("tower-line")).toHaveText(
      /^(T'as échappé la sauce\.|La tour est morte\. Vive la tour\.|Ça, c'était une caisse de trop\.|Les tomates ont choisi la gravité\.|On appelle ça une sauce maison\.|Presque\. Enfin, presque presque\.)$/,
    );
    await expect(card).toContainText(/Votre record : 2\s600\./);

    await card.getByRole("button", { name: "PLAY AGAIN" }).click();
    const second = await begin(page);
    expect(second.seed, "une autre partie, donc d'autres balancements").not.toBe(first.seed);
    await expect(score(page)).toHaveText("0");
    await expect(floors(page)).toHaveText("Étage 0");
    // Le premier score à battre est maintenant le mien, de tout à l'heure : c'est le plus proche.
    await expect(chase(page)).toHaveText(/Plus que 200 points pour battre ton record de la semaine !/);

    // La première caisse à côté : rien à enregistrer.
    await play(page, second, ["m"]);
    const empty = await result(page);
    await expect(empty.getByTestId("tower-final")).toHaveText("0");
    await expect(empty).toContainText("Hors classement : aucune caisse posée.");

    // Au clavier : la barre d'espace, qui lâchait les caisses une seconde plus tôt, ne relance rien ; Entrée, oui.
    await expect(empty).toBeFocused();
    await page.keyboard.press("Space");
    await expect(tower(page)).toHaveAttribute("data-screen", "over");
    await page.keyboard.press("Enter");
    const third = await begin(page);
    expect(third.seed).not.toBe(second.seed);
    await play(page, third, ["m"]);
    await (await result(page)).getByRole("button", { name: "LEADERBOARD" }).click();
    await expect(page.getByRole("tabpanel").locator("ol").first().getByRole("listitem").last()).toContainText(/6\s*Dominic Renzetti\s*vous\s*2 étages · combo x1 · 1 partie\s*200/);
  });

  test("pause : le jeu attend, reprend au même point ; « Arrêter là » garde ce qui est bâti", async ({ page }) => {
    await start(page);
    const run = await playNow(page);
    await play(page, run, ["p", "p"]);
    await advance(page, 320, run);

    await page.getByRole("button", { name: "Pause" }).click();
    const menu = page.getByRole("dialog", { name: "Pause" });
    await expect(menu).toBeVisible();
    // Le temps passe, la caisse ne bouge pas d'un tick : la preuve quatre lignes plus bas.
    await page.clock.runFor(4000);
    await expect(score(page)).toHaveText("600");
    await expect(tower(page)).toHaveAttribute("data-phase", "swinging");
    await menu.getByRole("button", { name: "RESUME" }).click();
    await expect(menu).toHaveCount(0);
    resumed(run);
    // Le parfait suivant tombe juste : le temps du jeu n'a pas avancé pendant la pause.
    await play(page, run, ["p"]);
    await expect(score(page)).toHaveText(points(1200));

    // La touche P met en pause aussi ; « Recommencer » repart de zéro, et ce qui était bâti compte quand même.
    await page.keyboard.press("p");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Recommencer" }).click();
    await expect(tower(page)).not.toHaveAttribute("data-seed", String(run.seed));
    const again = await begin(page);
    await expect(score(page)).toHaveText("0");
    await expect(chase(page)).toHaveText(/Plus que 1\s200 points pour battre ton record de la semaine !/);
    await play(page, again, ["p", "p", "p", "p"]);

    // « Arrêter là » : la partie s'arrête sans raté, et son score compte.
    await page.keyboard.press("Escape");
    await menu.getByRole("button", { name: "Arrêter là" }).click();
    const card = await result(page);
    await expect(card.getByTestId("tower-final")).toHaveText(points(2000));
    await expect(card).toContainText(/Étages\s*4/);
    await expect(card).toContainText(/Combo\s*x4/);
    // 2 000 points : devant Jimmy (1 900), derrière les quatre autres.
    await expect(card).toContainText(/Semaine\s*5e/);
    await card.getByRole("button", { name: "LEADERBOARD" }).click();
    await expect(page.getByRole("tabpanel").locator("ol").first().getByRole("listitem").nth(4)).toContainText(/5\s*Dominic Renzetti\s*vous\s*4 étages · combo x4 · 2 parties\s*2\s000/);
  });

  test("BEAT THIS SCORE : on part à la poursuite du score choisi", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "LEADERBOARD" }).click();
    await expect(tower(page)).toHaveAttribute("data-screen", "board");
    // Chacun sa ligne : rang, visage, nom, étages, meilleur combo, parties, score.
    const rows = page.getByRole("tabpanel").locator("ol").first().getByRole("listitem");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(1)).toContainText(/2\s*Alexandre Halle\s*21 étages · combo x4 · 1 partie\s*7\s400/);
    // Les semaines passées restent consultables.
    await expect(page.getByRole("tabpanel")).toContainText(/Les semaines d'avant\s*Marco · semaine du 2 nov\s*12\s400\s*Maya · semaine du 26 oct\s*10\s900/);

    await page.getByRole("button", { name: "Battre le score de Alexandre" }).click();
    const run = await begin(page);
    await expect(chase(page)).toHaveText(/Plus que 7\s400 points pour battre Alexandre !/);
    await play(page, run, ["p", "p"]);
    await expect(chase(page)).toHaveText(/Plus que 6\s800 points pour battre Alexandre !/);
  });

  test("le son se coupe (bouton ou touche M) et le choix est gardé", async ({ page }) => {
    await start(page);
    await playNow(page);
    const sound = page.getByRole("button", { name: "Couper le son" });
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await sound.click();
    await expect(page.getByRole("button", { name: "Remettre le son" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("m");
    await expect(page.getByRole("button", { name: "Couper le son" })).toBeVisible();
    await page.keyboard.press("m");
    expect(await page.evaluate(() => localStorage.getItem("tthq:tower:muted"))).toBe("1");

    await page.clock.resume();
    await openArcade(page);
    await freeze(page);
    await playNow(page);
    await expect(page.getByRole("button", { name: "Remettre le son" })).toBeVisible();
  });

  test("« X vient de détruire ton record » : quelqu'un me reprend la tête de la semaine", async ({ page }) => {
    await start(page);
    const run = await playNow(page);
    await play(page, run, ["p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "m"]);
    const card = await result(page);
    await expect(card).toContainText(/Semaine\s*1er/);

    // Maya joue, ailleurs (un autre onglet de la même démo), et fait mieux.
    const elsewhere = await page.context().newPage();
    await elsewhere.goto("/login");
    await elsewhere.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("tthq:demo:tower:v1") ?? "{}");
      const maya = db.runs.find((r: { score: number }) => r.score === 9800);
      db.runs.push({ ...maya, id: "tower-test-maya", score: 25000, floors: 40, finished_at: new Date().toISOString() });
      localStorage.setItem("tthq:demo:tower:v1", JSON.stringify(db));
    });
    // (L'avis s'affiche au tour d'horloge suivant.)
    await page.clock.runFor(300);
    await expect(page.getByText("Maya vient de détruire ton record 🍅")).toBeVisible();
    await elsewhere.close();
  });

  test("quitter le jeu libère la scène ; y revenir la remonte", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install({ time: WEDNESDAY });
    await openArcade(page);
    await expect(page.locator(".tower-stage canvas")).toHaveCount(1);
    await viaMenu(page, "Mes tâches");
    await expect(page).toHaveURL(/\/mes-taches$/);
    await expect(page.locator("canvas")).toHaveCount(0);
    await viaMenu(page, "Tomato Tower");
    await expect(page.locator(".tower-stage")).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    await expect(page.locator(".tower-stage canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe("Tomato Tower — la semaine", () => {
  test("lundi 0 h à Montréal : le classement de la semaine repart de zéro, l'historique reste, le gagnant porte la couronne", async ({ page }) => {
    // Dimanche, 23 h 40.
    await start(page, new Date("2026-11-15T23:40:00-05:00"));
    await expect(page.locator(".tower-home")).toContainText(/Remise à zéro\s*dans 20 min/);
    const run = await playNow(page);
    await play(page, run, ["p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "p", "m"]);
    const card = await result(page);
    await expect(card.getByTestId("tower-final")).toHaveText(points(11000));
    await expect(card).toContainText(/Semaine\s*1er/);

    // Une demi-heure plus tard, c'est lundi.
    await page.clock.fastForward("30:00");
    await page.clock.resume();
    await openArcade(page);
    const home = page.locator(".tower-home");
    await expect(home).toContainText("Personne n'a encore joué cette semaine.");
    await expect(home).toContainText("Dominic porte la couronne");
    await expect(home).toContainText(/Champion de la semaine du 9 nov · 11\s000/);
    await expect(home).toContainText(/Remise à zéro\s*dans 6 j 23 h/);
    // La couronne se porte partout où mon visage apparaît : ici dans le menu.
    await expect(page.locator('[aria-label="Dominic Renzetti"] .tower-crown').first()).toBeVisible();
    await expect(page.locator('[aria-label="Marco Drouin"] .tower-crown')).toHaveCount(0);

    await page.getByRole("button", { name: "LEADERBOARD" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("Rien ici pour le moment.");
    await expect(panel).toContainText(/Les semaines d'avant\s*Dominic · semaine du 9 nov\s*11\s000\s*Marco · semaine du 2 nov\s*12\s400/);
    await page.getByRole("tab", { name: "ALL TIME" }).click();
    await expect(panel.getByRole("listitem").nth(1)).toContainText(/Dominic Renzetti.*11\s000/);
    await page.getByRole("tab", { name: "MY STATS" }).click();
    await expect(panel).toContainText(/Semaines gagnées\s*1/);
    await expect(panel).toContainText(/Cette semaine\s*—/);
  });
});

test.describe("Tomato Tower — la tour d'équipe", () => {
  const status = (page: Page) => page.getByTestId("team-status");

  async function openTeam(page: Page, { standing = true }: { standing?: boolean } = {}) {
    await page.getByRole("button", { name: "TEAM TOWER" }).click();
    await expect(tower(page)).toHaveAttribute("data-screen", "team");
    if (standing) await expect(tower(page)).toHaveAttribute("data-team-seed", /^\d+$/);
  }

  test("une caisse par personne et par jour, à mon nom, et le lendemain une autre", async ({ page }) => {
    await start(page);
    await openTeam(page);
    const panel = page.locator(".tower-card").filter({ hasText: "Team Tower" });
    await expect(panel).toContainText(/Hauteur\s*11\s*depuis le 8 nov/);
    await expect(panel).toContainText(/Record\s*12/);
    await expect(panel).toContainText(/Aujourd'hui\s*1\s*Maya/);
    await expect(status(page)).toHaveText("C'est votre tour : une caisse, une seule chance aujourd'hui.");
    await expect(panel).toContainText(/Caisses posées\s*23/);

    // On peut viser, puis se raviser : la caisse n'est pas dépensée.
    await page.getByRole("button", { name: "POSER MA CAISSE" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Votre caisse du jour" })).toBeVisible();
    await page.getByRole("button", { name: "Pas maintenant" }).click();
    await expect(tower(page)).toHaveAttribute("data-mode", "idle");
    await expect(status(page)).toHaveText("C'est votre tour : une caisse, une seule chance aujourd'hui.");

    // Pile dessus.
    await page.getByRole("button", { name: "POSER MA CAISSE" }).click();
    await dropTeamCrate(page, "p");
    await expect(status(page)).toHaveText("Parfait ! La caisse suivante aura un peu plus de place.");
    await expect(panel).toContainText(/Hauteur\s*12/);
    await expect(panel).toContainText(/Aujourd'hui\s*2\s*Maya, Dominic/);
    await expect(panel).toContainText(/Caisses posées\s*24/);
    await expect(panel).toContainText(/Dernière caisse\s*Dominic, à l'instant/);
    // Mon nom sur mon étage, tout en haut de la liste.
    await expect(panel.locator("ol").last().getByRole("listitem").first()).toContainText(/12\s*Dominic · 11 nov\s*parfait/);
    await expect(page.getByRole("button", { name: "POSER MA CAISSE" })).toHaveCount(0);

    // Au rechargement, c'est toujours fait pour aujourd'hui.
    await page.clock.resume();
    await openArcade(page);
    await freeze(page);
    await openTeam(page);
    await expect(status(page)).toContainText("Votre caisse du jour est posée.");
    await expect(page.getByRole("button", { name: "POSER MA CAISSE" })).toHaveCount(0);

    // Le lendemain : une nouvelle caisse.
    await page.clock.fastForward("24:00:00");
    await page.clock.resume();
    await openArcade(page);
    await freeze(page);
    await openTeam(page);
    await expect(status(page)).toHaveText("C'est votre tour : une caisse, une seule chance aujourd'hui.");
    await page.getByRole("button", { name: "POSER MA CAISSE" }).click();
    await dropTeamCrate(page, "c");
    await expect(status(page)).toHaveText("Posée. Un peu de travers : la suivante aura moins de place.");
    await expect(panel).toContainText(/Hauteur\s*13/);
  });

  test("une caisse à côté, et la tour tombe pour la journée ; une nouvelle commence le lendemain, le record reste", async ({ page }) => {
    await start(page);
    await openTeam(page);
    const panel = page.locator(".tower-card").filter({ hasText: "Team Tower" });
    await page.getByRole("button", { name: "POSER MA CAISSE" }).click();
    await dropTeamCrate(page, "m");
    await expect(status(page)).toHaveText("La tour est morte. Vive la tour. Une nouvelle commence demain.");
    await expect(panel).toContainText(/Hauteur\s*0\s*Tombée/);
    await expect(panel).toContainText(/Record\s*12/);
    await expect(page.getByRole("button", { name: "POSER MA CAISSE" })).toHaveCount(0);
    await expect(panel).toContainText("La tour tombée, étage par étage");
    await expect(panel.locator("ol").last().getByRole("listitem").first()).toContainText(/12\s*Dominic · 11 nov\s*à côté/);

    // Plus personne ne peut y toucher aujourd'hui, et c'est dit à qui arrive.
    await page.clock.resume();
    await openArcade(page);
    await freeze(page);
    await openTeam(page, { standing: false });
    await expect(status(page)).toContainText("La tour est morte. Vive la tour. Dominic a posé la caisse de trop.");
    await expect(page.getByRole("button", { name: "POSER MA CAISSE" })).toHaveCount(0);

    // Demain : une tour neuve, et les chiffres de l'équipe gardent tout.
    await page.clock.fastForward("24:00:00");
    await page.clock.resume();
    await openArcade(page);
    await freeze(page);
    await openTeam(page);
    await expect(panel).toContainText(/Hauteur\s*0\s*depuis le 12 nov/);
    await expect(panel).toContainText(/Record\s*12/);
    await expect(panel).toContainText(/Tours bâties\s*3/);
    await expect(status(page)).toHaveText("C'est votre tour : une caisse, une seule chance aujourd'hui.");
    await page.getByRole("button", { name: "POSER MA CAISSE" }).click();
    await dropTeamCrate(page, "p");
    await expect(panel).toContainText(/Hauteur\s*1/);
  });
});

test.describe("Tomato Tower — au téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("en portrait, on joue au doigt : la page ne défile pas, tout tient à l'écran", async ({ page }) => {
    await page.clock.install({ time: WEDNESDAY });
    // Ici l'image garde sa taille : c'est elle que le doigt touche.
    await openArcade(page, { small: false });
    await freeze(page);
    // L'accueil : le titre, les deux boutons, le champion et le chemin du classement.
    await expect(page.getByRole("button", { name: "PLAY NOW" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "TEAM TOWER" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "LEADERBOARD" })).toBeInViewport();
    await expect(page.locator(".tower-home")).toContainText("Marco porte la couronne");

    const stage = page.locator(".tower-stage");
    expect(await stage.evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight && scrollY === 0);
    expect(await fits()).toBe(true);

    await page.getByRole("button", { name: "PLAY NOW" }).tap();
    const run = await begin(page);
    const box = (await stage.boundingBox())!;
    const tap = () => page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.7);
    await play(page, run, ["p", "p", "c"], tap);
    await expect(score(page)).toHaveText("700");
    await expect(floors(page)).toHaveText("Étage 3");
    // Le score, la pause et le son restent à l'écran, sans se chevaucher.
    await expect(score(page)).toBeInViewport();
    await expect(page.getByRole("button", { name: "Pause" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Couper le son" })).toBeInViewport();
    expect(await fits()).toBe(true);

    await play(page, run, ["m"], tap);
    const card = await result(page);
    await expect(card.getByTestId("tower-final")).toHaveText("700");
    await expect(card.getByRole("button", { name: "PLAY AGAIN" })).toBeInViewport();
    await expect(card.getByRole("button", { name: "LEADERBOARD" })).toBeInViewport();
    expect(await fits()).toBe(true);
  });
});
