/**
 * TOMATO TOWER — what the screens around the game are made of: the boards the
 * server computes, the week (Monday 00:00 in Montréal to the next one), the
 * shared tower, and the lines the game says.
 */
import type { Rect } from "./engine";

/** Where the week turns over, and what « today » means for the shared tower. */
export const TOWER_ZONE = "America/Toronto";

/** One line of a board: a member's best run over the period. */
export interface BoardRow {
  member_id: string;
  score: number;
  floors: number;
  /** Highest multiplier reached in that run (1 to 5). */
  best_combo: number;
  /** Runs played over the period. */
  runs: number;
  achieved_at: string;
}

export interface WeekChampion {
  /** Monday of that week, YYYY-MM-DD (Montréal). */
  week_start: string;
  member_id: string;
  score: number;
  floors: number;
}

export interface MyTowerStats {
  runs: number;
  best_score: number;
  best_floors: number;
  best_combo: number;
  best_streak: number;
  total_floors: number;
  perfects: number;
  average_score: number;
  weeks_won: number;
}

export interface TowerBoards {
  /** Monday of the current week (Montréal). */
  week_start: string;
  week: BoardRow[];
  all_time: BoardRow[];
  me: MyTowerStats;
  /** Past weeks and who won them, most recent first. */
  champions: WeekChampion[];
}

/** What the server says of a run once it has replayed it. */
export interface TowerRunResult {
  score: number;
  floors: number;
  best_combo: number;
  best_streak: number;
  perfects: number;
  /** My place on this week's board with this run counted. */
  rank_week: number;
  /** My best before this run, all time and this week. */
  previous_best: number;
  previous_week_best: number;
  /** The best score of the week before this run, whoever made it. */
  week_record_before: number;
}

export type TowerStart = { ok: true; run_id: string; seed: number } | { ok: false; error: string };
export type TowerFinish = ({ ok: true } & TowerRunResult) | { ok: false; error: string };

/* ------------------------------ team tower ------------------------------ */

export interface TeamCrate {
  floor: number;
  member_id: string | null;
  /** The day it was placed (Montréal), YYYY-MM-DD. */
  day: string;
  kind: "perfect" | "cut" | "miss";
  rect: Rect | null;
  placed_at: string;
}

export interface TeamTowerView {
  /** Today in Montréal. */
  today: string;
  /** The tower standing now. Null when today's fell: a new one starts tomorrow. */
  tower: { id: string; seed: number; started_on: string; height: number; top: Rect } | null;
  /** Its crates, bottom first. When the tower fell today: the crates of the fallen one. */
  crates: TeamCrate[];
  /** Who made it fall today, if it did. */
  fallen_by: string | null;
  /** Whether I have already placed my crate today. */
  played_today: boolean;
  stats: TeamTowerStats;
}

export interface TeamTowerStats {
  /** The tallest tower ever, and when it stopped growing (or today, if it still stands). */
  record_height: number;
  record_on: string | null;
  /** The day with the most crates placed, and how many. */
  best_day: string | null;
  best_day_crates: number;
  total_crates: number;
  towers: number;
  contributors: { member_id: string; crates: number; perfects: number }[];
  last: { member_id: string | null; placed_at: string; kind: TeamCrate["kind"] } | null;
}

export type TeamPlace =
  | { ok: true; kind: TeamCrate["kind"]; view: TeamTowerView }
  /** Someone placed a crate in the meantime: here is the tower as it is now, aim again. */
  | { ok: false; reason: "moved"; view: TeamTowerView }
  | { ok: false; reason: "played" | "fallen" | "error"; error: string; view?: TeamTowerView };

/* --------------------------------- weeks -------------------------------- */

function zoned(at: Date): { y: number; m: number; d: number; weekday: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOWER_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday, hour: Number(get("hour")), minute: Number(get("minute")) };
}

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Today in Montréal, YYYY-MM-DD. */
export function towerDay(at: Date): string {
  const z = zoned(at);
  return key(z.y, z.m, z.d);
}

/** The Monday of the week `at` falls in, in Montréal: the name of that week. */
export function towerWeekStart(at: Date): string {
  const z = zoned(at);
  const monday = new Date(Date.UTC(z.y, z.m - 1, z.d - z.weekday));
  return key(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
}

/** The instant a Montréal day begins. (Midnight there is 4 or 5 in the morning UTC, with the season.) */
function startOfDay(y: number, m: number, d: number): Date {
  for (const hour of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, hour));
    const z = zoned(candidate);
    if (z.hour === 0 && z.d === new Date(Date.UTC(y, m - 1, d)).getUTCDate()) return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, 5));
}

/** When the boards of the week start afresh: the coming Monday, 00:00 in Montréal. */
export function nextWeeklyReset(at: Date): Date {
  const z = zoned(at);
  const next = new Date(Date.UTC(z.y, z.m - 1, z.d - z.weekday + 7));
  return startOfDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** When the shared tower can take my next crate: the coming midnight in Montréal. */
export function nextTowerDay(at: Date): Date {
  const z = zoned(at);
  const next = new Date(Date.UTC(z.y, z.m - 1, z.d + 1));
  return startOfDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** « 3 j 4 h », « 5 h 12 », « 9 min » : how long until then. */
export function countdown(until: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((until.getTime() - now.getTime()) / 60000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const min = minutes % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(min).padStart(2, "0")}`;
  return `${Math.max(1, min)} min`;
}

/* --------------------------------- boards -------------------------------- */

/** A member's place on a board (1 = first); 0 when they are not on it. */
export function rankOf(rows: BoardRow[], memberId: string | null): number {
  const index = rows.findIndex((r) => r.member_id === memberId);
  return index < 0 ? 0 : index + 1;
}

/**
 * The score to chase while playing: the nearest one above mine on the week's
 * board, my own best of the week included (it is often the first to fall).
 * Null when nothing is left above: I lead, or nobody has played.
 */
export function scoreToBeat(week: BoardRow[], memberId: string | null, current: number): { score: number; member_id: string } | null {
  const above = week.filter((r) => r.score > current).sort((a, b) => a.score - b.score || (a.member_id === memberId ? 1 : -1))[0];
  return above ? { score: above.score, member_id: above.member_id } : null;
}

/** Who wears the crown: the winner of the most recent week that is over. */
export function reigningChampion(boards: Pick<TowerBoards, "champions"> | null): string | null {
  return boards?.champions[0]?.member_id ?? null;
}

/* ---------------------------------- lines --------------------------------- */

const GAME_OVER_LINES = [
  "T'as échappé la sauce.",
  "La tour est morte. Vive la tour.",
  "Ça, c'était une caisse de trop.",
  "Les tomates ont choisi la gravité.",
  "On appelle ça une sauce maison.",
  "Presque. Enfin, presque presque.",
];

/** What the game says when a run ends: one of a few lines, chosen by the run itself. */
export function gameOverLine(seed: number, floors: number): string {
  return GAME_OVER_LINES[(seed + floors) % GAME_OVER_LINES.length];
}

export const ZONES = [
  { from: 0, name: "Matin à la ferme" },
  { from: 10, name: "Plein midi" },
  { from: 20, name: "Coucher de soleil" },
  { from: 30, name: "Nuit étoilée" },
  { from: 40, name: "Au-dessus des nuages" },
] as const;

/** Which part of the sky a tower of that height has reached (0 to 4). */
export function zoneOf(floors: number): number {
  let zone = 0;
  for (let i = 0; i < ZONES.length; i++) if (floors >= ZONES[i].from) zone = i;
  return zone;
}
