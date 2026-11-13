/**
 * TOMATO TOWER — the director: it runs a game.
 *
 * It keeps the time (a fixed step of 1/60 s, whatever the screen's own pace),
 * asks the rules what a drop did (lib/tower/engine.ts), tells the scene and
 * the sound, and keeps the log the server will replay. The screens around the
 * game listen to it; nothing here knows about React or about the network.
 */
import { zoneOf } from "@/lib/tower/boards";
import {
  drop,
  floorPlan,
  initialState,
  MIN_DROP_TICK,
  SPAWN_TICKS,
  swingSmooth,
  teamDrop,
  teamPlan,
  TICKS_PER_SECOND,
  type DropKind,
  type FloorPlan,
  type Rect,
  type TowerState,
} from "@/lib/tower/engine";
import type { TowerAudio } from "./audio";
import type { TowerScene } from "./scene/scene";

export interface Hud {
  mode: "idle" | "solo" | "team";
  phase: "swinging" | "settling" | "over" | "asking";
  paused: boolean;
  score: number;
  floors: number;
  streak: number;
  multiplier: number;
  /** The highest multiplier reached in this run. */
  combo: number;
  zone: number;
  /** The last crate let go. `n` counts them, so that each one can replay its little animation. */
  last: { n: number; kind: DropKind; points: number; bonus: number; multiplier: number; grew: boolean } | null;
  /** My own best was passed during this run. */
  record: boolean;
}

export const IDLE_HUD: Hud = { mode: "idle", phase: "over", paused: false, score: 0, floors: 0, streak: 0, multiplier: 1, combo: 1, zone: 0, last: null, record: false };
const IDLE = IDLE_HUD;
const STEP = 1 / TICKS_PER_SECOND;

const shift = (r: Rect, axis: "x" | "z", by: number): Rect => (axis === "x" ? { ...r, x0: r.x0 + by, x1: r.x1 + by } : { ...r, z0: r.z0 + by, z1: r.z1 + by });

export class Director {
  hud: Hud = IDLE;
  private listeners = new Set<(hud: Hud) => void>();
  private state: TowerState = initialState(0);
  private drops: number[] = [];
  private crateTick = 0;
  private settle = 0;
  private acc = 0;
  private best = 0;
  private team: { seed: number; floor: number; top: Rect; memberId: string | null; onDrop: (tick: number) => void; tick: number } | null = null;

  constructor(
    private scene: TowerScene,
    private audio: TowerAudio,
  ) {}

  subscribe(listener: (hud: Hud) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<Hud>) {
    this.hud = { ...this.hud, ...patch };
    for (const l of this.listeners) l(this.hud);
  }

  /* --------------------------------- solo --------------------------------- */

  /** Starts a run with the seed the server gave. `best`: my record, to know when it falls. */
  begin(seed: number, best: number) {
    this.team = null;
    this.state = initialState(seed);
    this.drops = [];
    this.crateTick = 0;
    this.settle = 0;
    this.acc = 0;
    this.best = best;
    this.scene.resetTower();
    this.scene.setZone(0);
    this.scene.setView("play");
    this.set({ ...IDLE, mode: "solo", phase: "swinging" });
  }

  /** The log of the run so far: for each crate, the tick it was let go at. */
  log(): number[] {
    return [...this.drops];
  }

  get seed() {
    return this.state.seed;
  }

  /** Lets the crate go. Returns false when there was nothing to let go of. */
  drop(): boolean {
    if (this.hud.paused || this.hud.phase !== "swinging" || this.crateTick < MIN_DROP_TICK) return false;
    if (this.hud.mode === "team") return this.dropTeam();
    if (this.hud.mode !== "solo") return false;

    const floor = this.state.floors + 1;
    const out = drop(this.state, this.crateTick);
    this.drops.push(this.crateTick);
    const before = this.state;
    this.state = out.state;
    this.scene.land(out, floor);

    if (out.kind === "miss") {
      this.audio.over();
      this.scene.react("miss");
      this.scene.setView("over");
    } else {
      if (out.kind === "perfect") {
        this.audio.perfect(out.state.streak);
        if (out.multiplier > 1 && out.multiplier > Math.min(5, before.streak)) this.audio.combo(out.multiplier);
        this.scene.react("perfect");
      } else this.audio.place();
      if (out.bonus) this.audio.bonus();
    }
    const zone = zoneOf(out.state.floors);
    if (zone !== this.hud.zone) this.scene.setZone(zone);
    // My record falls once in a run: the moment the score passes it.
    const record = !this.hud.record && this.best > 0 && out.state.score > this.best;
    if (record) {
      this.audio.record();
      this.scene.react("record");
    }
    this.settle = 0;
    this.set({
      phase: out.state.over ? "over" : "settling",
      score: out.state.score,
      floors: out.state.floors,
      streak: out.state.streak,
      multiplier: out.kind === "perfect" ? out.multiplier : 1,
      combo: Math.max(this.hud.combo, out.kind === "perfect" ? out.multiplier : 1),
      zone,
      record: this.hud.record || record,
      last: { n: (this.hud.last?.n ?? 0) + 1, kind: out.kind, points: out.points, bonus: out.bonus, multiplier: out.multiplier, grew: out.grew },
    });
    return true;
  }

  /** Stops the run where it is (the player quits): what was built still counts. */
  stop() {
    if (this.hud.mode !== "solo" || this.hud.phase === "over") return;
    this.scene.setMoving(null, 0);
    this.scene.setView("over");
    this.set({ phase: "over", paused: false });
  }

  setPaused(paused: boolean) {
    if (this.hud.mode === "idle" || this.hud.phase === "over" || this.hud.paused === paused) return;
    this.acc = 0;
    this.set({ paused });
  }

  /* --------------------------------- team --------------------------------- */

  /**
   * My crate of the day swings above the shared tower. Letting it go calls
   * `onDrop` with the tick; the tower then waits for the server's answer
   * (see `teamLanded` and `aim` again, if the tower changed meanwhile).
   */
  aim(tower: { seed: number; height: number; top: Rect }, memberId: string | null, onDrop: (tick: number) => void) {
    this.team = { seed: tower.seed, floor: tower.height + 1, top: tower.top, memberId, onDrop, tick: 0 };
    this.crateTick = 0;
    this.acc = 0;
    this.scene.setView("team");
    this.set({ ...IDLE, mode: "team", phase: "swinging", floors: tower.height });
  }

  private dropTeam(): boolean {
    if (!this.team) return false;
    this.team.tick = this.crateTick;
    this.audio.click();
    this.set({ phase: "asking" });
    this.team.onDrop(this.crateTick);
    return true;
  }

  /** The server placed the crate: show where it landed (the same arithmetic gives the same place). */
  teamLanded(): DropKind | null {
    const team = this.team;
    if (!team) return null;
    const landed = teamDrop(team.seed, team.floor, team.top, team.tick);
    this.scene.land(landed, team.floor, team.memberId);
    if (landed.kind === "miss") {
      this.audio.over();
      this.scene.react("miss");
      this.scene.topple();
    } else if (landed.kind === "perfect") {
      this.audio.perfect(3);
      this.scene.react("perfect");
    } else this.audio.place();
    this.team = null;
    this.set({ mode: "idle", phase: "over", floors: landed.placed ? team.floor : team.floor - 1 });
    return landed.kind;
  }

  /** Leaves whatever was going on: no crate in the air, nothing to let go of. */
  idle() {
    this.team = null;
    this.scene.setMoving(null, 0);
    this.set({ ...IDLE });
  }

  /* --------------------------------- time --------------------------------- */

  /** Called once per frame, before the scene is drawn. */
  tick(dt: number) {
    const { mode, phase, paused } = this.hud;
    if (mode === "idle" || paused) return;
    // A frame that took too long (the tab was away) does not make the game leap.
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      if (this.hud.phase === "swinging") this.crateTick += 1;
      else if (this.hud.phase === "settling" && mode === "solo") {
        this.settle += 1;
        if (this.settle >= SPAWN_TICKS) {
          this.crateTick = 0;
          this.set({ phase: "swinging" });
        }
      }
    }
    if (phase === "over") return;
    if (this.hud.phase === "swinging" || this.hud.phase === "asking") {
      const team = mode === "team" ? this.team : null;
      const plan: FloorPlan = team ? teamPlan(team.seed, team.floor) : floorPlan(this.state.seed, this.state.floors + 1);
      const top = team ? team.top : this.state.top;
      // While the server is asked, the crate hangs where it was let go.
      const at = this.hud.phase === "asking" && team ? team.tick : this.crateTick + this.acc / STEP;
      this.scene.setMoving(shift(top, plan.axis, swingSmooth(plan, at)), team ? team.floor : this.state.floors + 1, team?.memberId ?? null);
    }
  }
}
