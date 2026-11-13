import { expect, test } from "@playwright/test";
import {
  BASE_SIZE,
  BONUS_POINTS,
  crateAt,
  drop,
  floorPlan,
  initialState,
  leastDurationMs,
  stepOf,
  MIN_DROP_TICK,
  replay,
  SPAWN_TICKS,
  swing,
  teamDrop,
  teamPlan,
  tolerance,
  TRAVEL,
  BASE_RECT,
  type TowerState,
} from "../src/lib/tower/engine";

/**
 * TOMATO TOWER — les règles, sans écran. Le même code compte le score dans le navigateur et le
 * recompte sur le serveur : ce qui est vérifié ici vaut pour les deux.
 */

const SEED = 20261113;

/** Le tick, pour la caisse du prochain étage, où elle est le plus près d'un décalage voulu. */
function tickFor(state: TowerState, wanted: number): number {
  const plan = floorPlan(state.seed, state.floors + 1);
  let best = MIN_DROP_TICK;
  for (let t = MIN_DROP_TICK; t <= plan.period + MIN_DROP_TICK; t++) {
    if (Math.abs(swing(plan, t) - wanted) < Math.abs(swing(plan, best) - wanted)) best = t;
  }
  return best;
}
const perfect = (state: TowerState) => drop(state, tickFor(state, 0));

test.describe("Tomato Tower — les règles", () => {
  test("la caisse se balance d'un bord à l'autre, à vitesse constante, de plus en plus vite avec les étages", () => {
    const plan = floorPlan(SEED, 1);
    expect(Math.abs(swing(plan, 0))).toBe(TRAVEL);
    const positions = Array.from({ length: plan.period * 2 }, (_, t) => swing(plan, t));
    expect(Math.max(...positions)).toBeLessThanOrEqual(TRAVEL);
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(-TRAVEL);
    // Un aller-retour par période : elle repasse au même endroit.
    expect(swing(plan, 7)).toBe(swing(plan, 7 + plan.period));
    // Le pas entre deux ticks est le même partout (à l'arrondi près), sauf au demi-tour.
    const steps = positions.slice(1, plan.period / 2 - 1).map((p, i) => Math.abs(p - positions[i]));
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(1);

    expect(floorPlan(SEED, 1).axis).toBe("x");
    expect(floorPlan(SEED, 2).axis).toBe("z");
    expect(floorPlan(SEED, 60).period).toBeLessThan(floorPlan(SEED, 1).period - 60);
    // Un plancher : passé une certaine hauteur, elle n'accélère plus.
    expect(floorPlan(SEED, 400).period).toBeGreaterThanOrEqual(80);
    expect(floorPlan(SEED, 400).period).toBeLessThanOrEqual(88);
    // Deux parties n'ont pas les mêmes cadences.
    const a = Array.from({ length: 30 }, (_, n) => floorPlan(1, n + 1));
    const b = Array.from({ length: 30 }, (_, n) => floorPlan(2, n + 1));
    expect(a.some((p, i) => p.period !== b[i].period || p.fromPositive !== b[i].fromPositive)).toBe(true);
  });

  test("un parfait ne coupe rien ; les parfaits d'affilée multiplient les points, jusqu'à x5", () => {
    let state = initialState(SEED);
    const points: number[] = [];
    for (let i = 0; i < 7; i++) {
      const out = perfect(state);
      expect(out.kind).toBe("perfect");
      expect(out.fallen).toBeNull();
      points.push(out.points);
      state = out.state;
    }
    // 200, puis x2 au deuxième, x3 au troisième… x5 au plus.
    expect(points).toEqual([200, 400, 600, 800, 1000, 1000, 1000]);
    expect(state.top).toEqual(BASE_RECT);
    expect(state.floors).toBe(7);
    expect(state.score).toBe(5000);
    expect(state.bestCombo).toBe(5);
    expect(state.bestStreak).toBe(7);
    expect(state.perfects).toBe(7);
  });

  test("ce qui dépasse est coupé et tombe ; la caisse suivante a la taille de ce qui reste", () => {
    const start = initialState(SEED);
    const tick = tickFor(start, 800);
    const { offset } = crateAt(start, tick);
    expect(Math.abs(offset - 800)).toBeLessThan(140);
    const out = drop(start, tick);
    expect(out.kind).toBe("cut");
    expect(out.points).toBe(100);
    expect(out.multiplier).toBe(1);
    // Posée à droite : la gauche de la caisse reste, sa droite tombe du bord de la tour.
    expect(out.placed).toEqual({ x0: -1500 + offset, x1: 1500, z0: -1500, z1: 1500 });
    expect(out.fallen).toEqual({ x0: 1500, x1: 1500 + offset, z0: -1500, z1: 1500 });
    expect(out.state.top).toEqual(out.placed);
    expect(out.state.streak).toBe(0);

    // L'étage suivant se joue sur l'autre axe, autour de ce qui reste.
    const next = drop(out.state, tickFor(out.state, -500));
    expect(next.kind).toBe("cut");
    expect(next.placed!.x0).toBe(out.placed!.x0);
    expect(next.placed!.z1 - next.placed!.z0).toBeLessThan(BASE_SIZE);
    expect(next.fallen!.z1).toBe(-1500);

    // Un coup coupé remet la série à zéro : le parfait suivant vaut 200, pas plus.
    const after = perfect(perfect(perfect(start).state).state);
    expect(after.multiplier).toBe(3);
    const broken = drop(after.state, tickFor(after.state, 600));
    expect(broken.state.streak).toBe(0);
    expect(perfect(broken.state).points).toBe(200);
  });

  test("la tolérance d'un parfait suit la taille de la caisse et sa vitesse : deux images d'écart restent un parfait", () => {
    // 6 % de la caisse, jamais moins que ce qu'elle parcourt en deux ticks, jamais plus que 45 % d'elle.
    expect(stepOf(188)).toBe(97);
    expect(tolerance(BASE_SIZE, 188)).toBe(194);
    expect(tolerance(BASE_SIZE, 400)).toBe(180);
    expect(tolerance(1000, 84)).toBe(438);
    expect(tolerance(400, 84)).toBe(180);

    const start = initialState(SEED);
    const plan = floorPlan(SEED, 1);
    const limit = tolerance(BASE_SIZE, plan.period);
    const ticks = Array.from({ length: plan.period }, (_, t) => t + MIN_DROP_TICK);
    const inside = ticks.filter((t) => Math.abs(swing(plan, t)) <= limit);
    const outside = ticks.filter((t) => Math.abs(swing(plan, t)) > limit && Math.abs(swing(plan, t)) < 600);
    for (const t of inside) expect(drop(start, t).kind).toBe("perfect");
    for (const t of outside) expect(drop(start, t).kind).toBe("cut");
    // À chaque passage au-dessus de la tour, au moins quatre ticks d'affilée donnent un parfait.
    const exact = tickFor(start, 0);
    for (const t of [exact - 2, exact - 1, exact, exact + 1]) expect(drop(start, t).kind).toBe("perfect");
    // Et encore tout en haut, quand la caisse file : la fenêtre ne se referme pas.
    let high = start;
    for (let i = 0; i < 70; i++) high = perfect(high).state;
    const top = tickFor(high, 0);
    for (const t of [top - 1, top, top + 1]) expect(drop(high, t).kind).toBe("perfect");
  });

  test("à côté de la tour, la partie est finie ; un bonus tombe tous les dix étages", () => {
    const start = initialState(SEED);
    const out = drop(start, tickFor(start, 3400));
    expect(out.kind).toBe("miss");
    expect(out.placed).toBeNull();
    expect(out.points).toBe(0);
    expect(out.state.over).toBe(true);
    expect(out.state.floors).toBe(0);
    expect(() => drop(out.state, 10)).toThrow();
    // Presque dehors : il ne reste pas de quoi tenir, la caisse bascule.
    const sliver = drop(start, tickFor(start, 2960));
    expect(Math.abs(crateAt(start, tickFor(start, 2960)).offset)).toBeGreaterThan(2910);
    expect(sliver.kind).toBe("miss");

    let state = start;
    let bonus = 0;
    for (let i = 0; i < 20; i++) {
      const o = perfect(state);
      bonus += o.bonus;
      if ((i + 1) % 10 === 0) expect(o.bonus).toBe(BONUS_POINTS);
      else expect(o.bonus).toBe(0);
      state = o.state;
    }
    expect(bonus).toBe(2000);
    expect(state.score).toBe(200 + 400 + 600 + 800 + 16 * 1000 + 2000);
  });

  test("après plusieurs parfaits d'affilée la caisse regagne un peu de surface, jamais plus que la première", () => {
    let state = initialState(SEED);
    state = drop(state, tickFor(state, 900)).state; // x rétréci
    state = drop(state, tickFor(state, -700)).state; // z rétréci
    const narrowed = { w: state.top.x1 - state.top.x0, d: state.top.z1 - state.top.z0, middle: state.top.x0 + state.top.x1 };
    expect(narrowed.w).toBeLessThan(2250);
    const widths: number[] = [];
    let grew = 0;
    for (let i = 0; i < 16; i++) {
      const o = perfect(state);
      expect(o.kind).toBe("perfect");
      if (o.grew) grew++;
      // Les trois premiers parfaits ne font rien grandir.
      if (i < 3) expect(o.grew).toBe(false);
      state = o.state;
      widths.push(state.top.x1 - state.top.x0);
    }
    expect(grew).toBeGreaterThan(4);
    expect(widths[widths.length - 1]).toBeGreaterThan(narrowed.w);
    expect(Math.max(...widths)).toBeLessThanOrEqual(BASE_SIZE);
    expect(state.top.z1 - state.top.z0).toBeLessThanOrEqual(BASE_SIZE);
    // Elle regrossit autour de son centre : la tour ne se déplace pas (à l'arrondi près).
    expect(Math.abs(state.top.x0 + state.top.x1 - narrowed.middle)).toBeLessThanOrEqual(16);
  });

  test("le serveur rejoue une partie depuis son journal et trouve le même score ; un journal impossible est refusé", () => {
    // Une partie jouée : chaque coup est le tick où la caisse a été lâchée.
    let state = initialState(SEED);
    const log: number[] = [];
    const wanted = [0, 0, 300, 0, 0, 0, -450, 0, 120, 0, 0, 0, 0, 2000, 0, 5000];
    for (const w of wanted) {
      if (state.over) break;
      const t = tickFor(state, w);
      log.push(t);
      state = drop(state, t).state;
    }
    expect(state.over).toBe(true);
    const again = replay(SEED, log);
    expect(again.valid).toBe(true);
    expect(again.state).toEqual(state);
    // Le temps de jeu : la somme des attentes, plus le temps de mise en place de chaque caisse.
    expect(again.state.ticks).toBe(log.reduce((a, b) => a + b, 0) + log.length * SPAWN_TICKS);
    expect(leastDurationMs(600)).toBe(10000);
    // Une autre graine, le même journal : une autre partie.
    expect(replay(SEED + 1, log).state.score).not.toBe(state.score);

    // Une partie quittée avant la chute est une partie quand même.
    const quit = replay(SEED, log.slice(0, 5));
    expect(quit.valid).toBe(true);
    expect(quit.state.over).toBe(false);
    expect(quit.state.floors).toBe(5);

    expect(replay(SEED, [...log, 30]).valid).toBe(false); // un coup après la fin
    expect(replay(SEED, [1]).valid).toBe(false); // lâchée avant d'être là
    expect(replay(SEED, [12.5]).valid).toBe(false);
    expect(replay(SEED, ["12"]).valid).toBe(false);
    expect(replay(SEED, [Number.NaN]).valid).toBe(false);
    expect(replay(SEED, "12,14" as unknown as number[]).valid).toBe(false);
    expect(replay(SEED, []).state.score).toBe(0);
  });

  test("la tour d'équipe : une caisse soignée rend de la place, une caisse de travers en prend, une caisse à côté fait tout tomber", () => {
    const plan = teamPlan(77, 1);
    const at = (wanted: number) => {
      let best = MIN_DROP_TICK;
      for (let t = MIN_DROP_TICK; t <= plan.period + MIN_DROP_TICK; t++) {
        if (Math.abs(swing(plan, t) - wanted) < Math.abs(swing(plan, best) - wanted)) best = t;
      }
      return best;
    };
    const narrow = { x0: -1000, x1: 1000, z0: -1500, z1: 1500 };
    const careful = teamDrop(77, 1, narrow, at(0));
    expect(careful.kind).toBe("perfect");
    expect(careful.placed!.x1 - careful.placed!.x0).toBe(2180);
    expect(careful.placed!.x0 + careful.placed!.x1).toBe(0);
    // Déjà à sa taille : elle ne grossit pas au-delà.
    expect(teamDrop(77, 1, BASE_RECT, at(0)).placed).toEqual(BASE_RECT);

    const crooked = teamDrop(77, 1, narrow, at(-500));
    expect(crooked.kind).toBe("cut");
    expect(crooked.placed!.x1 - crooked.placed!.x0).toBeLessThan(1700);
    expect(crooked.placed!.x0).toBe(-1000);
    expect(crooked.fallen!.x1).toBe(-1000);

    expect(teamDrop(77, 1, narrow, at(2600)).kind).toBe("miss");
    // Le balancement d'équipe ne s'emballe pas avec la hauteur.
    expect(Math.abs(teamPlan(77, 300).period - 132)).toBeLessThanOrEqual(6);
  });
});
