/**
 * TOMATO TOWER — the rules, as pure integer arithmetic.
 *
 * The same code runs in the browser, to play, and on the server, to replay a
 * run from the moments the player let each crate go and count the score
 * itself: a score is never taken from the browser. Everything here is an
 * integer (positions and sizes in thousandths of a crate, time in ticks of
 * 1/60 s), so both sides agree to the last point.
 *
 * The game: a crate swings above the tower, along x on odd floors and along z
 * on even ones. Let go, it lands; what overhangs is cut off and falls, and the
 * next crate is as small as what stayed. Land (almost) exactly and nothing is
 * cut: that is a « parfait ». Miss the tower and the run is over.
 */

export const TICKS_PER_SECOND = 60;
/** One crate unit, in the integers the rules count in. */
export const UNIT = 1000;
/** The first crate, and the largest a crate can be: 3 × 3. */
export const BASE_SIZE = 3 * UNIT;
/** How far a crate swings on each side of the tower. */
export const TRAVEL = 4600;
/** Ticks between a crate landing and the next one starting to swing. */
export const SPAWN_TICKS = 16;
/** The earliest a crate can be let go: it has to be on screen first. */
export const MIN_DROP_TICK = 4;
/** Less than this left on the tower and the crate tips over: a miss. */
const MIN_HOLD = 90;
/** Consecutive « parfaits » from which the crate grows back a little. */
export const GROW_FROM_STREAK = 4;
const GROW_BY = 180;
/** A bound for the server: nobody builds this high. */
export const MAX_FLOORS = 4000;

export const POINTS_PLACED = 100;
export const POINTS_PERFECT = 200;
export const COMBO_MAX = 5;
export const BONUS_EVERY = 10;
export const BONUS_POINTS = 1000;

export type Axis = "x" | "z";

/** A crate seen from above: its edges on both axes. */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface TowerState {
  seed: number;
  /** Crates placed so far (the base is not one of them). */
  floors: number;
  /** The top of the tower: where the next crate has to land. */
  top: Rect;
  /** Consecutive « parfaits » right now. */
  streak: number;
  score: number;
  /** The highest multiplier reached (1 to 5). */
  bestCombo: number;
  bestStreak: number;
  perfects: number;
  over: boolean;
  /** Game time used so far, in ticks: what the server compares with the clock. */
  ticks: number;
}

/** How the crate of a given floor swings. */
export interface FloorPlan {
  axis: Axis;
  /** Ticks for one swing there and back. */
  period: number;
  /** Which side it comes in from. */
  fromPositive: boolean;
}

export type DropKind = "perfect" | "cut" | "miss";

export interface DropOutcome {
  kind: DropKind;
  /** Where the crate was when it was let go (for the picture: it falls from there). */
  released: Rect;
  /** What stays on the tower. Null on a miss. */
  placed: Rect | null;
  /** What was cut off and falls. Null on a « parfait ». */
  fallen: Rect | null;
  /** Points for this crate, multiplier included; the floor bonus is apart. */
  points: number;
  bonus: number;
  /** 1 to 5: what the points were multiplied by. */
  multiplier: number;
  /** A « parfait » late enough in a streak: the crate grew back a little. */
  grew: boolean;
  state: TowerState;
}

/* ------------------------------ arithmetic ------------------------------ */

/** A small integer hash: the same sequence everywhere, from a seed and a floor. */
function mix(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const sizeOn = (r: Rect, axis: Axis) => (axis === "x" ? r.x1 - r.x0 : r.z1 - r.z0);

const shifted = (r: Rect, axis: Axis, by: number): Rect =>
  axis === "x" ? { ...r, x0: r.x0 + by, x1: r.x1 + by } : { ...r, z0: r.z0 + by, z1: r.z1 + by };

const withRange = (r: Rect, axis: Axis, lo: number, hi: number): Rect => (axis === "x" ? { ...r, x0: lo, x1: hi } : { ...r, z0: lo, z1: hi });

/* --------------------------------- rules -------------------------------- */

export function initialState(seed: number): TowerState {
  const half = BASE_SIZE / 2;
  return {
    seed: seed >>> 0,
    floors: 0,
    top: { x0: -half, x1: half, z0: -half, z1: half },
    streak: 0,
    score: 0,
    bestCombo: 1,
    bestStreak: 0,
    perfects: 0,
    over: false,
    ticks: 0,
  };
}

/**
 * How the crate of floor `n` (1 = the first one placed) swings: faster as the
 * tower grows, from a side and at a pace that depend on the run's seed, so
 * that no two runs are played with the same timings.
 */
export function floorPlan(seed: number, n: number): FloorPlan {
  const h = mix(seed, n);
  const quickening = Math.floor((n * 11) / 5);
  const period = Math.max(84, 190 - quickening) + (h % 9) - 4;
  return { axis: n % 2 === 1 ? "x" : "z", period, fromPositive: ((h >>> 9) & 1) === 1 };
}

/**
 * Where the crate is, `tick` ticks after it started to swing: its offset from
 * the top of the tower, between −TRAVEL and +TRAVEL, at a constant speed.
 */
export function swing(plan: FloorPlan, tick: number): number {
  const lap = 4 * TRAVEL;
  const along = Math.floor((tick * lap) / plan.period) % lap;
  const offset = along < 2 * TRAVEL ? -TRAVEL + along : 3 * TRAVEL - along;
  return plan.fromPositive ? -offset : offset;
}

/** The same swing between two ticks: for the picture only, the rules use `swing`. */
export function swingSmooth(plan: FloorPlan, tick: number): number {
  const lap = 4 * TRAVEL;
  const along = ((tick * lap) / plan.period) % lap;
  const offset = along < 2 * TRAVEL ? -TRAVEL + along : 3 * TRAVEL - along;
  return plan.fromPositive ? -offset : offset;
}

/** How far the crate moves in one tick. */
export function stepOf(period: number): number {
  return Math.floor((4 * TRAVEL) / period);
}

/**
 * How close to exact a « parfait » has to be. 6 % of the crate, and never less
 * than what the crate covers in two ticks: however fast it swings, letting go
 * a thirtieth of a second early or late is still a « parfait ». Never more
 * than 45 % of the crate either, so that a small one can still be cut.
 */
export function tolerance(size: number, period: number): number {
  const wide = Math.max(Math.floor((size * 60) / 1000), 2 * stepOf(period));
  return Math.min(wide, Math.floor((size * 45) / 100));
}

export function multiplierFor(streak: number): number {
  return streak >= 2 ? Math.min(COMBO_MAX, streak) : 1;
}

/** The crate of the next floor, where it is `tick` ticks after it appeared. */
export function crateAt(state: TowerState, tick: number): { plan: FloorPlan; rect: Rect; offset: number } {
  const plan = floorPlan(state.seed, state.floors + 1);
  const offset = swing(plan, tick);
  return { plan, rect: shifted(state.top, plan.axis, offset), offset };
}

/**
 * Lets the crate go at `tick`. Returns what happened and the state after it;
 * the state given is not modified.
 */
export function drop(state: TowerState, tick: number): DropOutcome {
  if (state.over) throw new Error("The run is over.");
  const { plan, rect: released, offset } = crateAt(state, tick);
  const axis = plan.axis;
  const size = sizeOn(state.top, axis);
  const [lo, hi] = axis === "x" ? [state.top.x0, state.top.x1] : [state.top.z0, state.top.z1];
  const ticks = state.ticks + tick + SPAWN_TICKS;
  const miss = (): DropOutcome => ({
    kind: "miss",
    released,
    placed: null,
    fallen: released,
    points: 0,
    bonus: 0,
    multiplier: 1,
    grew: false,
    state: { ...state, streak: 0, over: true, ticks },
  });

  const away = Math.abs(offset);
  if (away <= tolerance(size, plan.period)) {
    // « Parfait »: the crate sits exactly on the one below. Late in a streak it grows back, centred.
    const streak = state.streak + 1;
    const multiplier = multiplierFor(streak);
    const grow = streak >= GROW_FROM_STREAK ? Math.min(GROW_BY, BASE_SIZE - size) : 0;
    const half = Math.floor(grow / 2);
    const placed = withRange(state.top, axis, lo - half, hi + (grow - half));
    const floors = state.floors + 1;
    const points = POINTS_PERFECT * multiplier;
    const bonus = floors % BONUS_EVERY === 0 ? BONUS_POINTS : 0;
    return {
      kind: "perfect",
      released,
      placed,
      fallen: null,
      points,
      bonus,
      multiplier,
      grew: grow > 0,
      state: {
        ...state,
        floors,
        top: placed,
        streak,
        score: state.score + points + bonus,
        bestCombo: Math.max(state.bestCombo, multiplier),
        bestStreak: Math.max(state.bestStreak, streak),
        perfects: state.perfects + 1,
        ticks,
      },
    };
  }

  if (size - away < MIN_HOLD) return miss();

  // What overhangs is cut off; the next crate is as small as what stayed.
  const [keepLo, keepHi] = offset > 0 ? [lo + offset, hi] : [lo, hi + offset];
  const [cutLo, cutHi] = offset > 0 ? [hi, hi + offset] : [lo + offset, lo];
  const placed = withRange(state.top, axis, keepLo, keepHi);
  const floors = state.floors + 1;
  const bonus = floors % BONUS_EVERY === 0 ? BONUS_POINTS : 0;
  return {
    kind: "cut",
    released,
    placed,
    fallen: withRange(state.top, axis, cutLo, cutHi),
    points: POINTS_PLACED,
    bonus,
    multiplier: 1,
    grew: false,
    state: { ...state, floors, top: placed, streak: 0, score: state.score + POINTS_PLACED + bonus, ticks },
  };
}

/* -------------------------------- replays ------------------------------- */

export interface ReplayResult {
  /** False when the log could not have been played: the run is refused. */
  valid: boolean;
  reason?: string;
  state: TowerState;
}

/**
 * Plays a run again from its log: for each crate, the tick at which it was let
 * go. This is what the server does with what the browser sends; the score is
 * whatever comes out of it. A run may stop without a miss (the player quit).
 */
export function replay(seed: number, drops: readonly unknown[]): ReplayResult {
  let state = initialState(seed);
  if (!Array.isArray(drops) || drops.length > MAX_FLOORS + 1) return { valid: false, reason: "log", state };
  for (const tick of drops) {
    if (state.over) return { valid: false, reason: "drops after the end", state };
    if (typeof tick !== "number" || !Number.isInteger(tick) || tick < MIN_DROP_TICK || tick > 60 * TICKS_PER_SECOND * 10)
      return { valid: false, reason: "tick", state };
    state = drop(state, tick).state;
  }
  return { valid: true, state };
}

/** The least real time a run of that many game ticks can have taken, in milliseconds. */
export function leastDurationMs(ticks: number): number {
  return Math.floor((ticks * 1000) / TICKS_PER_SECOND);
}

/* ------------------------------- team tower ------------------------------ */

/**
 * The shared tower is the same game, one crate a day each: the crate swings at
 * a steady, friendly pace, and what a clumsy crate cuts off is lost to
 * everyone who comes after. The floor and the tower's own seed decide the swing.
 */
export function teamPlan(seed: number, n: number): FloorPlan {
  const h = mix(seed ^ 0x7ea3, n);
  return { axis: n % 2 === 1 ? "x" : "z", period: 132 + (h % 13) - 6, fromPositive: ((h >>> 9) & 1) === 1 };
}

export interface TeamDrop {
  kind: DropKind;
  released: Rect;
  placed: Rect | null;
  fallen: Rect | null;
}

/** One crate on the shared tower: the same geometry as a solo drop, without a score. */
export function teamDrop(seed: number, floor: number, top: Rect, tick: number): TeamDrop {
  const plan = teamPlan(seed, floor);
  const offset = swing(plan, tick);
  const axis = plan.axis;
  const released = shifted(top, axis, offset);
  const size = sizeOn(top, axis);
  const [lo, hi] = axis === "x" ? [top.x0, top.x1] : [top.z0, top.z1];
  const away = Math.abs(offset);
  if (away <= tolerance(size, plan.period)) {
    // A careful crate gives the next player a little room back.
    const grow = Math.min(GROW_BY, BASE_SIZE - size);
    const half = Math.floor(grow / 2);
    return { kind: "perfect", released, placed: withRange(top, axis, lo - half, hi + (grow - half)), fallen: null };
  }
  if (size - away < MIN_HOLD) return { kind: "miss", released, placed: null, fallen: released };
  const [keepLo, keepHi] = offset > 0 ? [lo + offset, hi] : [lo, hi + offset];
  const [cutLo, cutHi] = offset > 0 ? [hi, hi + offset] : [lo + offset, lo];
  return { kind: "cut", released, placed: withRange(top, axis, keepLo, keepHi), fallen: withRange(top, axis, cutLo, cutHi) };
}

export const BASE_RECT: Rect = { x0: -BASE_SIZE / 2, x1: BASE_SIZE / 2, z0: -BASE_SIZE / 2, z1: BASE_SIZE / 2 };
