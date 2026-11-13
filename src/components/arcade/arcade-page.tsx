"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMe, useMembersMap, useNow } from "@/lib/hooks";
import { getAdapter, loadTowerBoards, loadTowerTeam, setTowerTeam, ui, useApp } from "@/lib/store";
import { drop, floorPlan, initialState, type Rect } from "@/lib/tower/engine";
import { scoreToBeat, type BoardRow, type TeamPlace, type TeamTowerView, type TowerFinish, type TowerStart } from "@/lib/tower/boards";
import type { Member } from "@/lib/types";
import { firstName } from "@/lib/utils";
import { IDLE_HUD, type Hud } from "./director";
import { lookFor } from "./scene/cast";
import { Boards, GameHud, GameOver, Home, PauseMenu, TeamPanel, ZoneToast, type RunEnd } from "./screens";
import { Stage, type StageHandle } from "./stage";

type Screen = "home" | "play" | "over" | "board" | "team";
type Rival = { score: number; member_id: string };
type SharedTower = NonNullable<TeamTowerView["tower"]>;

/** What the scene shows of the shared tower: which one and how high, or the day it fell. */
const towerKey = (view: TeamTowerView) => (view.tower ? `${view.tower.id}:${view.tower.height}` : `fallen:${view.today}`);
/** The crates that stand, bottom first. A tower that fell leaves the base bare. */
const standing = (view: TeamTowerView) => (view.tower ? view.crates.filter((c) => c.rect).map((c) => ({ rect: c.rect!, memberId: c.member_id })) : []);

/**
 * What stands on the game's home: a few crates, some of them a little askew,
 * to say what this is about before anything is read. Placed by the rules
 * themselves, like any other tower.
 */
const SHOWCASE: { rect: Rect }[] = (() => {
  const seed = 1130;
  // Ticks away from exact, floor by floor: 0 is a « parfait ».
  const nudges = [0, 3, 0, -4, 0, 0, 4];
  const crates: { rect: Rect }[] = [];
  let state = initialState(seed);
  for (const nudge of nudges) {
    const landed = drop(state, Math.round(floorPlan(seed, state.floors + 1).period / 4) + nudge);
    if (!landed.placed) break;
    crates.push({ rect: landed.placed });
    state = landed.state;
  }
  return crates;
})();

/**
 * TOMATO TOWER, the page. One scene behind, one screen at a time in front:
 * the game's home, a run and its end, the boards, the team's tower. The page
 * holds what the screens show and talks to the server; the game itself is the
 * director's (director.ts), and what the server last said of the boards and of
 * the shared tower is the store's (it follows the changes wherever one is).
 */
export function ArcadePage() {
  const me = useMe();
  const members = useMembersMap();
  const now = useNow();
  const championId = useApp((s) => s.towerChampionId);
  const boards = useApp((s) => s.towerBoards);
  const team = useApp((s) => s.towerTeam);
  const [stage, setStage] = useState<StageHandle | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [hud, setHud] = useState<Hud>(IDLE_HUD);
  const [tab, setTab] = useState<"week" | "all" | "me">("week");
  const [teamNote, setTeamNote] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [muted, setMuted] = useState(false);
  /** A score chosen on the board with « BEAT THIS SCORE »: the one to chase first. */
  const [rival, setRival] = useState<Rival | null>(null);
  /** The seed of the run on show: what makes its crates swing the way they do. */
  const [seed, setSeed] = useState<number | null>(null);
  const run = useRef<{ id: string | null; seed: number; unranked: string | null } | null>(null);
  const starting = useRef(false);
  /** The run is being stopped to start another at once: its score is kept, its result is not shown. */
  const quiet = useRef(false);
  /** What the scene shows of the shared tower (see towerKey); null when it shows something else. */
  const shown = useRef<string | null>(null);
  /** The tower my crate of the day swings over; null when it is not in the air. */
  const aimed = useRef<SharedTower | null>(null);
  /** My crate was let go and the server has not answered yet. */
  const asking = useRef(false);
  const meId = me?.id ?? null;

  // The dashboard's tiles sit on the picture; the game takes the whole window, edge to edge.
  useEffect(() => {
    ui.setBareWindow(true);
    return () => ui.setBareWindow(false);
  }, []);

  // The boards follow the changes on their own (see boot.ts); opening the game reads them afresh all the same.
  useEffect(() => {
    void loadTowerBoards();
  }, []);

  /* ---------------------------------- a run ---------------------------------- */

  /** A run is over (a miss, or the player stopped there): the server replays it and says what it is worth. */
  const finish = useCallback(
    (final: Hud) => {
      if (!stage) return;
      const current = run.current;
      const shown = !quiet.current;
      quiet.current = false;
      // A run in which no crate was placed is not a score: nothing is sent, nothing is kept.
      const unranked = current?.unranked ?? (final.floors === 0 ? "aucune caisse posée." : null);
      if (shown) {
        setEnd({ seed: current?.seed ?? 0, score: final.score, floors: final.floors, combo: final.combo, saved: null, unranked });
        // The fall is watched for a moment; then the result.
        window.setTimeout(() => {
          if (run.current === current) setScreen((s) => (s === "play" ? "over" : s));
        }, 850);
      }
      if (!current?.id || unranked) return;
      getAdapter()
        .towerFinish(current.id, stage.director.log())
        .catch((): TowerFinish => ({ ok: false, error: "Le serveur n'a pas répondu : ce score n'est pas enregistré." }))
        .then((saved) => {
          void loadTowerBoards();
          // Another run has started since: this answer is no longer the one on show.
          if (run.current !== current) return;
          setEnd((e) => (e ? { ...e, saved } : e));
          if (saved.ok && saved.rank_week === 1 && saved.score > saved.week_record_before) {
            stage.audio.record();
            stage.scene.react("weekly");
          }
        });
    },
    [stage],
  );

  const play = useCallback(
    async (chase: Rival | null = null) => {
      if (!stage || starting.current) return;
      starting.current = true;
      // From a gesture: this is what lets a phone make sound.
      stage.audio.unlock();
      stage.audio.click();
      let started: TowerStart;
      try {
        started = await getAdapter().towerStart();
      } catch {
        started = { ok: false, error: "le serveur n'a pas répondu." };
      }
      starting.current = false;
      // Without the server the game is still a game: the run is played, it just does not count.
      const next = started.ok
        ? { id: started.run_id, seed: started.seed, unranked: null }
        : { id: null, seed: Math.floor(Math.random() * 4294967296), unranked: started.error };
      run.current = next;
      setSeed(next.seed);
      setRival(chase);
      setEnd(null);
      stage.scene.setPodium([]);
      stage.director.begin(next.seed, useApp.getState().towerBoards?.me.best_score ?? 0);
      setScreen("play");
    },
    [stage],
  );

  const pause = useCallback(() => stage?.director.setPaused(true), [stage]);

  /** « Recommencer »: what was built so far is recorded like any run that stops, and another begins. */
  const restart = useCallback(() => {
    if (!stage) return;
    quiet.current = stage.director.hud.mode === "solo" && stage.director.hud.phase !== "over";
    stage.director.setPaused(false);
    stage.director.stop();
    void play(rival);
  }, [stage, play, rival]);

  const toggleSound = useCallback(() => {
    if (!stage) return;
    stage.audio.setMuted(!stage.audio.muted);
    setMuted(stage.audio.muted);
  }, [stage]);

  /* -------------------------------- team tower ------------------------------- */

  /** My crate was let go: the server places it (it alone knows what the tower is right now). */
  const place = useCallback(
    async (tick: number) => {
      const tower = aimed.current;
      if (!stage || !tower || asking.current) return;
      asking.current = true;
      setTeamBusy(true);
      let out: TeamPlace;
      try {
        out = await getAdapter().towerTeamPlace(tower.id, tower.height + 1, tick);
      } catch {
        out = { ok: false, reason: "error", error: "Connexion perdue : votre caisse n'est pas posée, elle n'est pas perdue non plus." };
      }
      asking.current = false;
      setTeamBusy(false);
      if (out.ok) {
        aimed.current = null;
        const kind = stage.director.teamLanded();
        // The scene has just shown this very crate land: nothing to raise again.
        shown.current = towerKey(out.view);
        setTowerTeam(out.view);
        setTeamNote(
          kind === "perfect"
            ? "Parfait ! La caisse suivante aura un peu plus de place."
            : kind === "cut"
              ? "Posée. Un peu de travers : la suivante aura moins de place."
              : "La tour est morte. Vive la tour. Une nouvelle commence demain.",
        );
      } else if (out.reason === "moved") {
        // Someone was quicker: my crate is not spent. The tower is raised as it is now, and it swings again.
        toast("Quelqu'un vient de poser une caisse : visez de nouveau.");
        shown.current = null;
        setTowerTeam(out.view);
      } else {
        aimed.current = null;
        stage.director.idle();
        toast.error(out.error);
        if (out.view) setTowerTeam(out.view);
        else void loadTowerTeam();
      }
    },
    [stage],
  );

  const aim = useCallback(() => {
    if (!stage || !team?.tower || team.played_today) return;
    stage.audio.unlock();
    setTeamNote(null);
    aimed.current = team.tower;
    stage.director.aim(team.tower, meId, (tick) => void place(tick));
  }, [stage, team, meId, place]);

  /** The crate goes back in the shed: it was not let go, it is not spent. */
  const holdBack = useCallback(() => {
    if (!stage || asking.current) return;
    aimed.current = null;
    stage.director.idle();
  }, [stage]);

  const openTeam = useCallback(() => {
    if (!stage) return;
    stage.audio.unlock();
    stage.audio.click();
    setTeamNote(null);
    setScreen("team");
    void loadTowerTeam().then((view) => {
      if (!view) toast.error("La tour d'équipe ne répond pas. Réessayez dans un instant.");
    });
  }, [stage]);

  /* --------------------------------- the scene -------------------------------- */

  const cast = useMemo(
    () =>
      Object.values(members)
        .filter((m: Member) => m.active)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        .slice(0, 8)
        .map((m) => ({ id: m.id, name: firstName(m.full_name), look: lookFor(m) })),
    [members],
  );
  useEffect(() => {
    stage?.scene.setCast(cast, meId, championId);
  }, [stage, cast, meId, championId]);

  // The game says what happens to it; the end of a run is acted upon once, as it happens.
  useEffect(() => {
    if (!stage) return;
    let before = stage.director.hud;
    return stage.director.subscribe((next) => {
      setHud(next);
      if (next.mode === "solo" && next.phase === "over" && before.phase !== "over") finish(next);
      before = next;
    });
  }, [stage, finish]);

  // What the scene shows behind each screen.
  useEffect(() => {
    if (!stage) return;
    const { scene, director } = stage;
    if (screen === "home" || screen === "team") {
      director.idle();
      if (screen === "home") scene.buildTower(SHOWCASE);
      else scene.resetTower();
      scene.setPodium([]);
      scene.setZone(0);
      scene.setView(screen === "home" ? "lobby" : "team");
    } else if (screen === "board") {
      director.idle();
      scene.setView("board");
    }
    // Whatever stood there of the shared tower is gone, or about to be raised again (the effect below).
    shown.current = null;
    aimed.current = null;
  }, [stage, screen]);

  // The top three of the board on show climb the podium.
  useEffect(() => {
    if (!stage || screen !== "board") return;
    const rows = tab === "all" ? boards?.all_time : boards?.week;
    stage.scene.setPodium((rows ?? []).slice(0, 3).map((r) => r.member_id));
  }, [stage, screen, tab, boards]);

  // The shared tower in the scene follows what the server says of it.
  useEffect(() => {
    if (!stage || screen !== "team" || !team) return;
    const key = towerKey(team);
    // While my own crate is being placed, the answer says what to show.
    if (shown.current === key || asking.current) return;
    const before = shown.current;
    shown.current = key;
    const last = team.crates[team.crates.length - 1];
    if (team.tower && last?.rect && before === `${team.tower.id}:${team.tower.height - 1}`) {
      // A teammate's crate, seen as it lands.
      stage.scene.land({ kind: last.kind, released: last.rect, placed: last.rect, fallen: null }, last.floor, last.member_id);
      if (last.kind === "perfect") stage.audio.perfect(1);
      else stage.audio.place();
    } else if (!team.tower && before && !before.startsWith("fallen:")) {
      // It came down while I was looking at it.
      stage.scene.topple();
      stage.audio.over();
    } else {
      stage.scene.buildTower(standing(team));
    }
    // My crate was swinging over a tower that is no longer the same: it swings over the new one.
    if (aimed.current) {
      if (team.tower && !team.played_today) {
        aimed.current = team.tower;
        stage.director.aim(team.tower, meId, (tick) => void place(tick));
      } else {
        aimed.current = null;
        stage.director.idle();
      }
    }
  }, [stage, screen, team, meId, place]);

  /* ----------------------------------- input ---------------------------------- */

  const press = useCallback(() => {
    if (!stage) return;
    stage.audio.unlock();
    if (screen === "play" || (screen === "team" && hud.mode === "team")) stage.director.drop();
  }, [stage, screen, hud.mode]);

  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const { director, audio } = stage;
      const aiming = screen === "team" && director.hud.mode === "team";
      if ((e.code === "Space" || e.key === "Enter") && (screen === "play" || aiming)) {
        // On a button, the key is the button's.
        if (target?.closest("button, a, [role=tab]")) return;
        e.preventDefault();
        if (e.repeat) return;
        audio.unlock();
        director.drop();
      } else if (e.key === "Enter" && screen === "over") {
        // The result is on show: Enter plays again (the space bar does not, it was dropping crates a second ago).
        if (target?.closest("button, a")) return;
        e.preventDefault();
        void play(rival);
      } else if ((e.key === "p" || e.key === "P" || e.key === "Escape") && screen === "play" && director.hud.phase !== "over") {
        e.preventDefault();
        director.setPaused(!director.hud.paused);
      } else if (e.key === "Escape" && aiming) {
        e.preventDefault();
        holdBack();
      } else if (e.key === "m" || e.key === "M") {
        toggleSound();
      }
    };
    // Away from the tab: the game waits, and so does the sound.
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (stage.director.hud.mode === "solo") stage.director.setPaused(true);
      stage.audio.suspend();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [stage, screen, holdBack, toggleSound, play, rival]);

  /* --------------------------------- what to chase -------------------------------- */

  const chase = useMemo(() => {
    if (screen !== "play" || !boards) return null;
    const target = rival && hud.score < rival.score ? rival : scoreToBeat(boards.week, meId, hud.score);
    if (!target) {
      const others = boards.week.some((r) => r.member_id !== meId);
      return others && hud.score > 0 ? { text: "KING OF TOMATOES 👑", member: null } : null;
    }
    const gap = (target.score - hud.score).toLocaleString("fr-CA");
    const who = members[target.member_id];
    return target.member_id === meId
      ? { text: `Plus que ${gap} points pour battre ton record de la semaine !`, member: who ?? null }
      : { text: `Plus que ${gap} points pour battre ${who ? firstName(who.full_name) : "le meneur"} !`, member: who ?? null };
  }, [screen, boards, rival, hud.score, meId, members]);

  const zone = screen === "play" || screen === "over" ? hud.zone : 0;

  return (
    <div
      className="tower-page"
      data-screen={screen}
      data-mode={hud.mode}
      data-phase={hud.phase}
      data-seed={seed ?? ""}
      data-team-seed={team?.tower?.seed ?? ""}
      data-team-height={team?.tower?.height ?? ""}
    >
      <Stage
        zone={zone}
        onReady={(handle) => {
          setStage(handle);
          if (handle) setMuted(handle.audio.muted);
        }}
        onPress={press}
      >
        {screen === "home" && (
          <Home boards={boards} members={members} meId={meId} now={now} ready={!!stage} onPlay={() => void play()} onTeam={openTeam} onBoard={() => setScreen("board")} />
        )}
        {screen === "play" && (
          <>
            <GameHud hud={hud} chase={chase} muted={muted} onPause={pause} onMute={toggleSound} />
            <ZoneToast zone={hud.zone} />
            {hud.paused && (
              <PauseMenu
                onResume={() => {
                  // Back from another tab, the sound was put to sleep with the game.
                  stage?.audio.unlock();
                  stage?.director.setPaused(false);
                }}
                onRestart={restart}
                onQuit={() => {
                  stage?.director.setPaused(false);
                  stage?.director.stop();
                }}
              />
            )}
          </>
        )}
        {screen === "over" && end && <GameOver end={end} onAgain={() => void play(rival)} onBoard={() => setScreen("board")} onHome={() => setScreen("home")} />}
        {screen === "board" && (
          <Boards
            boards={boards}
            members={members}
            meId={meId}
            now={now}
            tab={tab}
            onTab={setTab}
            onBeat={(row: BoardRow) => void play({ score: row.score, member_id: row.member_id })}
            onPlay={() => void play()}
            onClose={() => setScreen("home")}
          />
        )}
        {screen === "team" && (
          <TeamPanel
            view={team}
            members={members}
            meId={meId}
            now={now}
            aiming={hud.mode === "team"}
            busy={teamBusy}
            note={teamNote}
            onAim={aim}
            onHoldBack={holdBack}
            onClose={() => setScreen("home")}
          />
        )}
      </Stage>
    </div>
  );
}
