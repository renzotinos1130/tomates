import { expect, type Page } from "@playwright/test";
import { drop, floorPlan, initialState, MIN_DROP_TICK, SPAWN_TICKS, teamPlan, type FloorPlan, type TowerState } from "../src/lib/tower/engine";

/**
 * Jouer à TOMATO TOWER dans un test, au tick près.
 *
 * Le jeu compte le temps en ticks de 1/60 s. Sous l'horloge de Playwright, mise en pause, chaque
 * image dure exactement 16 ms : on sait donc, image par image, combien de ticks le jeu a comptés
 * (24 ticks toutes les 25 images), et on peut lâcher une caisse à l'instant précis où elle est
 * au-dessus de la tour. Les règles (src/lib/tower/engine.ts) disent alors ce que la partie vaut,
 * et le test compare avec ce que l'écran affiche.
 */

export const FRAME = 16;
/** Ticks comptés par le jeu, tant d'images après avoir remis son compteur à zéro. */
const ticksAt = (frames: number) => Math.floor((24 * frames) / 25);
/** Le plus petit nombre d'images après lequel le jeu a compté ce nombre de ticks. */
function framesFor(ticks: number): number {
  let k = Math.ceil((ticks * 25) / 24);
  while (ticksAt(k) < ticks) k++;
  // Toutes les 25 images, l'arrondi du jeu se joue à un cheveu : on prend l'image d'après, même compte.
  return k % 25 === 0 ? k + 1 : k;
}

/** 'p' : parfait · 'c' : de travers (une coupe) · 'm' : à côté · un nombre : tant de ticks après l'instant exact. */
export type Move = "p" | "c" | "m" | number;

export interface Run {
  seed: number;
  /** La partie, telle que les règles la comptent. */
  state: TowerState;
  frames: number;
  /** Tick (total) où la caisse en l'air a commencé à se balancer. */
  spawn: number;
  /** Où le jeu a remis son compteur à zéro pour la dernière fois : au départ, ou à la fin d'une pause. */
  frames0: number;
  ticks0: number;
}

const WEBGL = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist"];
/** La scène est en WebGL : sans carte graphique, le navigateur de test la dessine en logiciel. */
export const webgl = { launchOptions: { args: WEBGL } };

export const tower = (page: Page) => page.locator(".tower-page");

/**
 * Ouvre le jeu et attend que la scène soit chargée. L'horloge doit déjà être installée.
 *
 * `small` (par défaut) : la scène est dessinée dans un timbre-poste. Le navigateur de test la
 * calcule sans carte graphique, image par image ; en petit, une partie de quinze étages se joue en
 * quelques secondes au lieu d'une minute. Le jeu, lui, ne voit pas la différence : mêmes règles,
 * même boucle, mêmes écrans par-dessus. Le test au doigt, qui touche l'image, la garde entière.
 */
export async function openArcade(page: Page, { small = true }: { small?: boolean } = {}) {
  await page.goto("/arcade");
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator(".tower-stage")).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  if (small) await page.addStyleTag({ content: ".tower-stage > div:has(> canvas) { right: auto !important; bottom: auto !important; width: 96px !important; height: 60px !important; }" });
}

/** Met l'horloge en pause : à partir d'ici, le temps n'avance que par `advance` et `play`. */
export async function freeze(page: Page) {
  // « Maintenant » a le temps de passer entre la lecture de l'heure et la pause, sur une machine chargée : on vise un peu plus loin.
  for (const ahead of [1500, 6000, 30000]) {
    const now = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(now + ahead);
      break;
    } catch (err) {
      if (ahead === 30000) throw err;
    }
  }
  await page.clock.runFor(FRAME * 20);
}

/** La partie vient de commencer (horloge en pause) : lit sa graine et prépare le suivi. */
export async function begin(page: Page): Promise<Run> {
  await expect(tower(page)).toHaveAttribute("data-screen", "play");
  await expect(tower(page)).toHaveAttribute("data-seed", /^\d+$/);
  const seed = Number(await tower(page).getAttribute("data-seed"));
  return { seed, state: initialState(seed), frames: 0, spawn: 0, frames0: 0, ticks0: 0 };
}

/** Laisse passer du temps de jeu (un nombre entier d'images). */
export async function advance(page: Page, ms: number, run?: Run) {
  const frames = Math.round(ms / FRAME);
  await page.clock.runFor(frames * FRAME);
  if (run) run.frames += frames;
}

/** Après une pause : le jeu repart avec un compteur vide. */
export function resumed(run: Run) {
  run.ticks0 += ticksAt(run.frames - run.frames0);
  run.frames0 = run.frames;
}

/** Le tick où lâcher : la caisse passe au-dessus de la tour toutes les demi-périodes, au bout de sa course entre deux. */
function tickFor(plan: FloorPlan, move: Move, notBefore: number): number {
  const half = plan.period / 2;
  const first = move === "m" ? 0 : Math.round(plan.period / 4) + (move === "p" ? 0 : move === "c" ? 4 : move);
  let want = first;
  for (let j = 0; want < Math.max(MIN_DROP_TICK, notBefore); j++) want = Math.round(first + j * half);
  return want;
}

/** Joue ces coups, l'un après l'autre, avec `press` (une touche, un toucher). Met `run.state` à jour selon les règles. */
export async function play(page: Page, run: Run, moves: Move[], press: () => Promise<void> = () => page.keyboard.press("Space")) {
  const total = (frames: number) => run.ticks0 + ticksAt(frames - run.frames0);
  for (const move of moves) {
    const plan = floorPlan(run.seed, run.state.floors + 1);
    const want = tickFor(plan, move, total(run.frames) - run.spawn + 1);
    const frames = run.frames0 + framesFor(run.spawn + want - run.ticks0);
    await page.clock.runFor((frames - run.frames) * FRAME);
    run.frames = frames;
    await press();
    run.state = drop(run.state, total(frames) - run.spawn).state;
    run.spawn = total(frames) + SPAWN_TICKS;
  }
}

/**
 * Tour d'équipe : ma caisse du jour vient de commencer à se balancer (horloge en pause). La lâche
 * pile dessus, de travers ou à côté.
 */
export async function dropTeamCrate(page: Page, move: Move, press: () => Promise<void> = () => page.keyboard.press("Space")) {
  await expect(tower(page)).toHaveAttribute("data-mode", "team");
  const seed = Number(await tower(page).getAttribute("data-team-seed"));
  const height = Number(await tower(page).getAttribute("data-team-height"));
  const want = tickFor(teamPlan(seed, height + 1), move, 1);
  await page.clock.runFor(framesFor(want) * FRAME);
  await press();
}

/** Un nombre de points comme l'écran l'écrit (« 1 200 »), quelle que soit l'espace utilisée. */
export const points = (n: number) => new RegExp(`^${n.toLocaleString("fr-CA").replace(/\s/g, "\\s")}$`);
