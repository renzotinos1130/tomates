"use server";

/**
 * TOMATO TOWER, on the server: the only place a score or a crate is written.
 *
 *  - startTowerRun     opens a run for the member who asks, with the seed the run
 *                      will be played with.
 *  - finishTowerRun    takes the log of a run (for each crate, the tick it was let
 *                      go at), replays it with the same rules as the browser
 *                      (lib/tower/engine.ts) and records the score IT counted. A
 *                      log that could not have been played, or a run that claims
 *                      more game time than the clock allows, is refused.
 *  - placeTeamCrate    works out where a crate lands on the shared tower, from the
 *                      tower's seed and the tick, and hands it to the database,
 *                      which places it atomically (or says the tower has changed).
 *
 * Each function first works out who is asking, from the session cookie, and
 * that they are an active member.
 */
import { randomInt } from "node:crypto";
import { leastDurationMs, replay, teamDrop, MIN_DROP_TICK, type Rect } from "@/lib/tower/engine";
import type { TowerFinish, TowerStart } from "@/lib/tower/boards";
import { getSupabaseAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const NOT_CONFIGURED = "Le jeu n'est pas configuré sur ce serveur (clé de service Supabase absente).";
const NOT_ALLOWED = "Réservé aux membres de l'équipe.";
const UNEXPECTED = "Une erreur est survenue. Réessayez dans un instant.";
/** A run left open longer than this is not closed any more. */
const RUN_OPEN_FOR_MS = 3 * 60 * 60 * 1000;
/** Runs one member may open in ten minutes: far more than anyone plays, far less than a script would. */
const RUNS_PER_TEN_MINUTES = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The member who asks, if they are an active one. */
async function player(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: member } = await getSupabaseAdminClient()
    .from("members")
    .select("id, active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  return member && member.active && !member.must_change_password ? (member.id as string) : null;
}

export async function startTowerRun(): Promise<TowerStart> {
  if (!isSupabaseConfigured || !isAdminConfigured) return { ok: false, error: NOT_CONFIGURED };
  try {
    const me = await player();
    if (!me) return { ok: false, error: NOT_ALLOWED };
    const admin = getSupabaseAdminClient();
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin.from("tower_runs").select("id", { count: "exact", head: true }).eq("member_id", me).gte("started_at", since);
    if ((count ?? 0) >= RUNS_PER_TEN_MINUTES) return { ok: false, error: "Doucement : trop de parties d'un coup. Reprenez dans quelques minutes." };

    const seed = randomInt(0, 2 ** 32);
    const { data, error } = await admin.from("tower_runs").insert({ member_id: me, seed }).select("id").single();
    if (error || !data) return { ok: false, error: UNEXPECTED };
    return { ok: true, run_id: data.id as string, seed };
  } catch (err) {
    console.error("[tower] startTowerRun", err instanceof Error ? err.message : err);
    return { ok: false, error: UNEXPECTED };
  }
}

export async function finishTowerRun(input: { runId: string; drops: number[] }): Promise<TowerFinish> {
  if (!isSupabaseConfigured || !isAdminConfigured) return { ok: false, error: NOT_CONFIGURED };
  try {
    const me = await player();
    if (!me) return { ok: false, error: NOT_ALLOWED };
    const runId = typeof input?.runId === "string" && UUID.test(input.runId) ? input.runId : null;
    if (!runId) return { ok: false, error: "Cette partie est inconnue." };

    const admin = getSupabaseAdminClient();
    const { data: run } = await admin.from("tower_runs").select("id, member_id, seed, started_at, finished_at").eq("id", runId).maybeSingle();
    if (!run || run.member_id !== me) return { ok: false, error: "Cette partie est inconnue." };
    if (run.finished_at) return { ok: false, error: "Cette partie est déjà enregistrée." };
    const elapsed = Date.now() - new Date(run.started_at as string).getTime();
    if (elapsed > RUN_OPEN_FOR_MS) return { ok: false, error: "Cette partie a commencé il y a trop longtemps pour être enregistrée." };

    // The score is whatever comes out of playing the log again, here.
    const played = replay(Number(run.seed), input?.drops);
    if (!played.valid) return { ok: false, error: "Cette partie n'a pas pu être vérifiée : elle n'est pas enregistrée." };
    const { state } = played;
    // A run in which no crate was placed is not a score: it is forgotten, not ranked last.
    if (state.floors === 0) {
      await admin.from("tower_runs").delete().eq("id", runId).is("finished_at", null);
      return { ok: false, error: "Aucune caisse posée : rien à enregistrer." };
    }
    // A run cannot have lasted less than its own game time (a little slack for the trip here).
    const least = leastDurationMs(state.ticks);
    if (elapsed < least * 0.9 - 2500) return { ok: false, error: "Cette partie n'a pas pu être vérifiée : elle n'est pas enregistrée." };

    const { data: closed, error } = await admin.rpc("tower_close_run", {
      p_run: runId,
      p_member: me,
      p_score: state.score,
      p_floors: state.floors,
      p_best_combo: state.bestCombo,
      p_best_streak: state.bestStreak,
      p_perfects: state.perfects,
      p_duration_ms: least,
    });
    if (error) return { ok: false, error: UNEXPECTED };
    if (!closed) return { ok: false, error: "Cette partie est déjà enregistrée." };
    const standing = closed as { rank_week: number; previous_best: number; previous_week_best: number; week_record_before: number };
    return {
      ok: true,
      score: state.score,
      floors: state.floors,
      best_combo: state.bestCombo,
      best_streak: state.bestStreak,
      perfects: state.perfects,
      ...standing,
    };
  } catch (err) {
    console.error("[tower] finishTowerRun", err instanceof Error ? err.message : err);
    return { ok: false, error: UNEXPECTED };
  }
}

export type TeamCrateOutcome =
  | { ok: true; kind: "perfect" | "cut" | "miss" }
  | { ok: false; reason: "moved" | "played" | "fallen" | "error"; error: string };

export async function placeTeamCrate(input: { towerId: string; floor: number; tick: number }): Promise<TeamCrateOutcome> {
  if (!isSupabaseConfigured || !isAdminConfigured) return { ok: false, reason: "error", error: NOT_CONFIGURED };
  try {
    const me = await player();
    if (!me) return { ok: false, reason: "error", error: NOT_ALLOWED };
    const towerId = typeof input?.towerId === "string" && UUID.test(input.towerId) ? input.towerId : null;
    const floor = Number.isInteger(input?.floor) ? input.floor : 0;
    const tick = Number.isInteger(input?.tick) ? input.tick : -1;
    if (!towerId || floor < 1 || tick < MIN_DROP_TICK || tick > 60 * 60 * 10) return { ok: false, reason: "error", error: "Cette caisse n'a pas pu être posée." };

    const admin = getSupabaseAdminClient();
    const { data: tower } = await admin.from("tower_team_towers").select("id, seed, height, x0, x1, z0, z1, fallen_on").eq("id", towerId).maybeSingle();
    if (!tower || tower.fallen_on) return { ok: false, reason: "fallen", error: "La tour est tombée. Une nouvelle commence demain." };
    if (tower.height !== floor - 1) return { ok: false, reason: "moved", error: "Quelqu'un vient de poser une caisse : visez de nouveau." };

    const top: Rect = { x0: tower.x0, x1: tower.x1, z0: tower.z0, z1: tower.z1 };
    const landed = teamDrop(Number(tower.seed), floor, top, tick);
    const { data: status, error } = await admin.rpc("tower_team_commit", {
      p_tower: towerId,
      p_floor: floor,
      p_member: me,
      p_kind: landed.kind,
      p_x0: landed.placed?.x0 ?? null,
      p_x1: landed.placed?.x1 ?? null,
      p_z0: landed.placed?.z0 ?? null,
      p_z1: landed.placed?.z1 ?? null,
    });
    if (error) return { ok: false, reason: "error", error: UNEXPECTED };
    if (status === "ok") return { ok: true, kind: landed.kind };
    if (status === "moved") return { ok: false, reason: "moved", error: "Quelqu'un vient de poser une caisse : visez de nouveau." };
    if (status === "played") return { ok: false, reason: "played", error: "Vous avez déjà posé votre caisse aujourd'hui." };
    return { ok: false, reason: "fallen", error: "La tour est tombée. Une nouvelle commence demain." };
  } catch (err) {
    console.error("[tower] placeTeamCrate", err instanceof Error ? err.message : err);
    return { ok: false, reason: "error", error: UNEXPECTED };
  }
}
