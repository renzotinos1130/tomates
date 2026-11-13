/**
 * TOMATO TOWER in demo mode: the server's part, played by the browser.
 *
 * Same rules as the real thing (a run is replayed from its log before its
 * score counts; one crate a day each on the shared tower), kept in
 * localStorage. The demo starts with a few weeks of scores from the rest of
 * the team and a shared tower already under way, so that the boards have
 * something to say and there is a score to chase.
 */
import { BASE_RECT, MIN_DROP_TICK, replay, swing, teamDrop, teamPlan, type Rect } from "./engine";
import {
  nextWeeklyReset,
  towerDay,
  towerWeekStart,
  type BoardRow,
  type MyTowerStats,
  type TeamCrate,
  type TeamPlace,
  type TeamTowerStats,
  type TeamTowerView,
  type TowerBoards,
  type TowerFinish,
  type TowerStart,
  type WeekChampion,
} from "./boards";

interface DemoRun {
  id: string;
  member_id: string;
  seed: number;
  started_at: string;
  finished_at: string | null;
  score: number;
  floors: number;
  best_combo: number;
  best_streak: number;
  perfects: number;
  week_start: string | null;
}

interface DemoTower {
  id: string;
  seed: number;
  started_on: string;
  height: number;
  top: Rect;
  fallen_on: string | null;
  fallen_by: string | null;
  created_at: string;
}

interface DemoCrate extends TeamCrate {
  tower_id: string;
}

export interface TowerDemoDb {
  runs: DemoRun[];
  towers: DemoTower[];
  crates: DemoCrate[];
}

const STORAGE_KEY = "tthq:demo:tower:v1";
const DAY = 86_400_000;

let seq = 0;
const newId = () => `tower-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

/** A small generator: the sample data is the same for everyone, whatever the day. */
function sequence(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* --------------------------------- sample -------------------------------- */

type Team = { dominic: string; alexandre: string; maya: string; marco: string; antoine: string; jimmy: string };

/** A crate landed about `wanted` away from exact, on a tower of that seed. */
function landing(seed: number, floor: number, top: Rect, wanted: number) {
  const plan = teamPlan(seed, floor);
  let tick = MIN_DROP_TICK;
  for (let t = MIN_DROP_TICK; t <= plan.period + MIN_DROP_TICK; t++) {
    if (Math.abs(swing(plan, t) - wanted) < Math.abs(swing(plan, tick) - wanted)) tick = t;
  }
  return teamDrop(seed, floor, top, tick);
}

export function seedTowerDemo(now: Date, team: Team): TowerDemoDb {
  const weekOpens = nextWeeklyReset(now).getTime() - 7 * DAY;
  const sinceOpen = Math.max(60_000, now.getTime() - weekOpens);
  const run = (member_id: string, at: number, score: number, floors: number, best_combo: number, perfects: number, n: number): DemoRun => ({
    id: `tower-seed-${n}`,
    member_id,
    seed: 1000 + n,
    started_at: new Date(at - 90_000).toISOString(),
    finished_at: new Date(at).toISOString(),
    score,
    floors,
    best_combo,
    best_streak: best_combo + (n % 4),
    perfects,
    week_start: towerWeekStart(new Date(at)),
  });
  // This week, spread between its Monday and now; then the three weeks before.
  const inWeek = (part: number) => weekOpens + sinceOpen * part;
  const earlier = (weeks: number, part: number) => weekOpens - weeks * 7 * DAY + 7 * DAY * part;
  const runs: DemoRun[] = [
    run(team.maya, inWeek(0.82), 9800, 24, 5, 13, 1),
    run(team.maya, inWeek(0.35), 6100, 17, 4, 8, 2),
    run(team.alexandre, inWeek(0.6), 7400, 21, 4, 9, 3),
    run(team.marco, inWeek(0.5), 5200, 16, 3, 6, 4),
    run(team.marco, inWeek(0.2), 2300, 9, 2, 3, 5),
    run(team.antoine, inWeek(0.7), 3100, 11, 3, 4, 6),
    run(team.jimmy, inWeek(0.4), 1900, 8, 2, 2, 7),
    run(team.marco, earlier(1, 0.6), 12400, 28, 5, 17, 8),
    run(team.maya, earlier(1, 0.3), 8700, 22, 5, 11, 9),
    run(team.dominic, earlier(1, 0.5), 2600, 10, 2, 3, 10),
    run(team.alexandre, earlier(1, 0.8), 6900, 19, 4, 8, 11),
    run(team.maya, earlier(2, 0.4), 10900, 26, 5, 15, 12),
    run(team.antoine, earlier(2, 0.7), 4400, 14, 3, 5, 13),
    run(team.jimmy, earlier(2, 0.2), 3800, 13, 3, 4, 14),
    run(team.alexandre, earlier(3, 0.5), 8100, 21, 4, 10, 15),
    run(team.marco, earlier(3, 0.3), 7700, 20, 4, 9, 16),
  ];

  // The shared towers. One fell last week; the one standing was begun three days ago.
  const next = sequence(20261113);
  const dayKey = (ago: number) => towerDay(new Date(now.getTime() - ago * DAY));
  const towers: DemoTower[] = [];
  const crates: DemoCrate[] = [];
  const build = (id: string, seed: number, startedAgo: number, days: { ago: number; who: string[] }[], fall?: { ago: number; who: string }) => {
    let top = BASE_RECT;
    let height = 0;
    for (const day of days) {
      day.who.forEach((member_id, i) => {
        const wanted = next() < 0.45 ? 0 : Math.round((next() - 0.5) * 520);
        const landed = landing(seed, height + 1, top, wanted);
        if (!landed.placed) return;
        height += 1;
        top = landed.placed;
        crates.push({
          tower_id: id,
          floor: height,
          member_id,
          day: dayKey(day.ago),
          kind: landed.kind,
          rect: landed.placed,
          placed_at: new Date(now.getTime() - day.ago * DAY - (day.who.length - i) * 2_400_000 - 600_000).toISOString(),
        });
      });
    }
    if (fall) {
      crates.push({
        tower_id: id,
        floor: height + 1,
        member_id: fall.who,
        day: dayKey(fall.ago),
        kind: "miss",
        rect: null,
        placed_at: new Date(now.getTime() - fall.ago * DAY - 3_600_000).toISOString(),
      });
    }
    towers.push({
      id,
      seed,
      started_on: dayKey(startedAgo),
      height,
      top,
      fallen_on: fall ? dayKey(fall.ago) : null,
      fallen_by: fall?.who ?? null,
      created_at: new Date(now.getTime() - startedAgo * DAY).toISOString(),
    });
  };
  build(
    "tower-seed-a",
    4242,
    9,
    [
      { ago: 9, who: [team.maya, team.marco, team.dominic, team.alexandre] },
      { ago: 8, who: [team.antoine, team.maya, team.jimmy, team.marco, team.alexandre] },
      { ago: 7, who: [team.dominic, team.maya, team.antoine] },
    ],
    { ago: 6, who: team.jimmy },
  );
  build("tower-seed-b", 9090, 3, [
    { ago: 3, who: [team.maya, team.alexandre, team.marco] },
    { ago: 2, who: [team.antoine, team.jimmy, team.maya, team.marco] },
    { ago: 1, who: [team.alexandre, team.antoine, team.dominic] },
    { ago: 0, who: [team.maya] },
  ]);
  return { runs, towers, crates };
}

/* -------------------------------- storage -------------------------------- */

let memory: TowerDemoDb | null = null;

export function loadTowerDemo(now: Date, team: Team): TowerDemoDb {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TowerDemoDb;
      if (Array.isArray(parsed.runs) && Array.isArray(parsed.towers) && Array.isArray(parsed.crates)) return (memory = parsed);
    }
  } catch {
    /* no storage: the demo lives for this visit */
  }
  memory = seedTowerDemo(now, team);
  saveTowerDemo(memory);
  return memory;
}

export function saveTowerDemo(db: TowerDemoDb) {
  memory = db;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* quota or private mode */
  }
}

/** « Réinitialiser la démo », or another tab changed it: read again next time. */
export function forgetTowerDemo(clear: boolean) {
  memory = null;
  if (!clear) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const TOWER_DEMO_KEY = STORAGE_KEY;

/* --------------------------------- boards -------------------------------- */

function board(runs: DemoRun[]): BoardRow[] {
  const best = new Map<string, DemoRun>();
  const played = new Map<string, number>();
  for (const r of runs) {
    played.set(r.member_id, (played.get(r.member_id) ?? 0) + 1);
    const b = best.get(r.member_id);
    if (!b || r.score > b.score || (r.score === b.score && (r.finished_at as string) < (b.finished_at as string))) best.set(r.member_id, r);
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || ((a.finished_at as string) < (b.finished_at as string) ? -1 : 1))
    .map((r) => ({
      member_id: r.member_id,
      score: r.score,
      floors: r.floors,
      best_combo: r.best_combo,
      runs: played.get(r.member_id) ?? 1,
      achieved_at: r.finished_at as string,
    }));
}

export function demoBoards(db: TowerDemoDb, me: string | null, now: Date): TowerBoards {
  const finished = db.runs.filter((r) => r.finished_at);
  const week_start = towerWeekStart(now);
  const weeks = [...new Set(finished.map((r) => r.week_start as string))].filter((w) => w < week_start).sort().reverse();
  const champions: WeekChampion[] = weeks.slice(0, 26).map((w) => {
    const top = board(finished.filter((r) => r.week_start === w))[0];
    return { week_start: w, member_id: top.member_id, score: top.score, floors: top.floors };
  });
  const mine = finished.filter((r) => r.member_id === me);
  const stats: MyTowerStats = {
    runs: mine.length,
    best_score: Math.max(0, ...mine.map((r) => r.score)),
    best_floors: Math.max(0, ...mine.map((r) => r.floors)),
    best_combo: Math.max(1, ...mine.map((r) => r.best_combo)),
    best_streak: Math.max(0, ...mine.map((r) => r.best_streak)),
    total_floors: mine.reduce((n, r) => n + r.floors, 0),
    perfects: mine.reduce((n, r) => n + r.perfects, 0),
    average_score: mine.length ? Math.round(mine.reduce((n, r) => n + r.score, 0) / mine.length) : 0,
    weeks_won: champions.filter((c) => c.member_id === me).length,
  };
  return {
    week_start,
    week: board(finished.filter((r) => r.week_start === week_start)),
    all_time: board(finished),
    me: stats,
    champions,
  };
}

export function demoStart(db: TowerDemoDb, me: string | null, now: Date): TowerStart {
  if (!me) return { ok: false, error: "Réservé aux membres de l'équipe." };
  const run: DemoRun = {
    id: newId(),
    member_id: me,
    seed: Math.floor(Math.random() * 4294967296),
    started_at: now.toISOString(),
    finished_at: null,
    score: 0,
    floors: 0,
    best_combo: 1,
    best_streak: 0,
    perfects: 0,
    week_start: null,
  };
  // Runs that were opened and never finished are not kept around.
  db.runs = [...db.runs.filter((r) => r.finished_at || now.getTime() - new Date(r.started_at).getTime() < DAY), run];
  saveTowerDemo(db);
  return { ok: true, run_id: run.id, seed: run.seed };
}

export function demoFinish(db: TowerDemoDb, me: string | null, runId: string, drops: number[], now: Date): TowerFinish {
  const run = db.runs.find((r) => r.id === runId);
  if (!run || run.member_id !== me) return { ok: false, error: "Cette partie est inconnue." };
  if (run.finished_at) return { ok: false, error: "Cette partie est déjà enregistrée." };
  const played = replay(run.seed, drops);
  if (!played.valid) return { ok: false, error: "Cette partie n'a pas pu être vérifiée : elle n'est pas enregistrée." };
  const { state } = played;
  if (state.floors === 0) {
    db.runs = db.runs.filter((r) => r !== run);
    saveTowerDemo(db);
    return { ok: false, error: "Aucune caisse posée : rien à enregistrer." };
  }

  const before = demoBoards(db, me, now);
  const previous_week_best = before.week.find((r) => r.member_id === me)?.score ?? 0;
  Object.assign(run, {
    finished_at: now.toISOString(),
    score: state.score,
    floors: state.floors,
    best_combo: state.bestCombo,
    best_streak: state.bestStreak,
    perfects: state.perfects,
    week_start: towerWeekStart(now),
  });
  saveTowerDemo(db);
  const counted = Math.max(state.score, previous_week_best);
  return {
    ok: true,
    score: state.score,
    floors: state.floors,
    best_combo: state.bestCombo,
    best_streak: state.bestStreak,
    perfects: state.perfects,
    rank_week: 1 + before.week.filter((r) => r.member_id !== me && r.score > counted).length,
    previous_best: before.me.best_score,
    previous_week_best,
    week_record_before: before.week[0]?.score ?? 0,
  };
}

/* ------------------------------- team tower ------------------------------ */

function teamStats(db: TowerDemoDb, today: string): TeamTowerStats {
  const placed = db.crates.filter((c) => c.kind !== "miss");
  const tallest = [...db.towers].sort((a, b) => b.height - a.height || (a.created_at < b.created_at ? -1 : 1))[0];
  const perDay = new Map<string, number>();
  for (const c of placed) perDay.set(c.day, (perDay.get(c.day) ?? 0) + 1);
  const bestDay = [...perDay.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0];
  const byMember = new Map<string, { crates: number; perfects: number }>();
  for (const c of db.crates) {
    if (!c.member_id) continue;
    const s = byMember.get(c.member_id) ?? { crates: 0, perfects: 0 };
    if (c.kind !== "miss") s.crates += 1;
    if (c.kind === "perfect") s.perfects += 1;
    byMember.set(c.member_id, s);
  }
  const last = [...db.crates].sort((a, b) => (a.placed_at < b.placed_at ? 1 : -1))[0];
  return {
    record_height: tallest?.height ?? 0,
    record_on: tallest ? (tallest.fallen_on ?? today) : null,
    best_day: bestDay?.[0] ?? null,
    best_day_crates: bestDay?.[1] ?? 0,
    total_crates: placed.length,
    towers: db.towers.length,
    contributors: [...byMember.entries()]
      .map(([member_id, s]) => ({ member_id, ...s }))
      .sort((a, b) => b.crates - a.crates || b.perfects - a.perfects || (a.member_id < b.member_id ? -1 : 1)),
    last: last ? { member_id: last.member_id, placed_at: last.placed_at, kind: last.kind } : null,
  };
}

export function demoTeamView(db: TowerDemoDb, me: string | null, now: Date): TeamTowerView {
  const today = towerDay(now);
  let standing = db.towers.find((t) => !t.fallen_on) ?? null;
  const fellToday = db.towers.find((t) => t.fallen_on === today) ?? null;
  if (!standing && !fellToday) {
    standing = {
      id: newId(),
      seed: Math.floor(Math.random() * 4294967296),
      started_on: today,
      height: 0,
      top: BASE_RECT,
      fallen_on: null,
      fallen_by: null,
      created_at: now.toISOString(),
    };
    db.towers.push(standing);
    saveTowerDemo(db);
  }
  const shown = standing ?? fellToday;
  return {
    today,
    tower: standing ? { id: standing.id, seed: standing.seed, started_on: standing.started_on, height: standing.height, top: standing.top } : null,
    crates: db.crates
      .filter((c) => c.tower_id === shown?.id)
      .sort((a, b) => a.floor - b.floor)
      .map(({ floor, member_id, day, kind, rect, placed_at }) => ({ floor, member_id, day, kind, rect, placed_at })),
    fallen_by: standing ? null : (fellToday?.fallen_by ?? null),
    played_today: db.crates.some((c) => c.day === today && c.member_id === me),
    stats: teamStats(db, today),
  };
}

export function demoTeamPlace(db: TowerDemoDb, me: string | null, towerId: string, floor: number, tick: number, now: Date): TeamPlace {
  const view = () => demoTeamView(db, me, now);
  if (!me) return { ok: false, reason: "error", error: "Réservé aux membres de l'équipe." };
  const today = towerDay(now);
  const tower = db.towers.find((t) => t.id === towerId);
  if (!tower || tower.fallen_on) return { ok: false, reason: "fallen", error: "La tour est tombée. Une nouvelle commence demain.", view: view() };
  if (tower.height !== floor - 1) return { ok: false, reason: "moved", view: view() };
  if (db.crates.some((c) => c.day === today && c.member_id === me)) {
    return { ok: false, reason: "played", error: "Vous avez déjà posé votre caisse aujourd'hui.", view: view() };
  }
  const landed = teamDrop(tower.seed, floor, tower.top, tick);
  db.crates.push({ tower_id: tower.id, floor, member_id: me, day: today, kind: landed.kind, rect: landed.placed, placed_at: now.toISOString() });
  if (landed.placed) {
    tower.height = floor;
    tower.top = landed.placed;
  } else {
    tower.fallen_on = today;
    tower.fallen_by = me;
  }
  saveTowerDemo(db);
  return { ok: true, kind: landed.kind, view: view() };
}
