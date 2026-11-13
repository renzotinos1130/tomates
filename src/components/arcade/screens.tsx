"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Gamepad, Pause, Play, RotateCcw, Trophy, Users, Volume2, VolumeX, X } from "@/components/kit/icons";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { PixelText } from "@/components/kit/pixel-text";
import { Button } from "@/components/ui/button";
import { formatShortDate, parseDateOnly, relativeTime } from "@/lib/dates";
import {
  countdown,
  gameOverLine,
  nextTowerDay,
  nextWeeklyReset,
  rankOf,
  ZONES,
  type BoardRow,
  type TeamTowerView,
  type TowerBoards,
  type TowerFinish,
} from "@/lib/tower/boards";
import type { Member } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";
import type { Hud } from "./director";

type Members = Record<string, Member>;

const points = (n: number) => n.toLocaleString("fr-CA");
const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);
const nameOf = (members: Members, id: string | null) => (id && members[id] ? firstName(members[id].full_name) : "Quelqu'un");

/**
 * A panel laid over the scene: opaque, so that what it says is read whatever is
 * behind. `data-tower-panel` on one tells the scene to keep its subject clear of
 * it (see freeArea in stage.tsx).
 */
export function Card({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("tower-card rounded-2xl bg-popover/[0.97] p-4 text-popover-foreground shadow-pop", className)} {...props}>
      {children}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-navy-500 uppercase">{label}</p>
      <p className="mt-0.5 truncate text-lg leading-6 font-semibold text-navy-900 tabular">{value}</p>
      {hint && <p className="truncate text-xs text-navy-600">{hint}</p>}
    </div>
  );
}

/* ---------------------------------- home --------------------------------- */

export function Home({
  boards,
  members,
  meId,
  now,
  ready,
  onPlay,
  onTeam,
  onBoard,
}: {
  boards: TowerBoards | null;
  members: Members;
  meId: string | null;
  now: Date;
  /** The scene is loaded: until then there is nothing to play on. */
  ready: boolean;
  onPlay: () => void;
  onTeam: () => void;
  onBoard: () => void;
}) {
  const champion = boards?.champions[0] ?? null;
  const leader = boards?.week[0] ?? null;
  const mine = boards ? rankOf(boards.week, meId) : 0;
  return (
    <div className="tower-home pointer-events-none absolute inset-0 flex flex-col justify-end gap-3 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <Card data-tower-panel className="pointer-events-auto w-full p-5 sm:p-6 lg:max-w-[400px]">
        <h1 className="sr-only">Tomato Tower</h1>
        <PixelText text="Tomato Tower" unit={3} className="text-tomato-600 max-[400px]:scale-90 max-[400px]:origin-left" />
        <p className="mt-2.5 text-[15px] font-medium tracking-tight text-navy-800">Stack it. Grow it. Own it.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-navy-600">
          Empilez les caisses de tomates le plus haut possible. Pile dessus, c&apos;est un parfait ; à côté, c&apos;est fini.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={onPlay} disabled={!ready}>
            <Play /> PLAY NOW
          </Button>
          <Button size="lg" variant="outline" onClick={onTeam} disabled={!ready}>
            <Users /> TEAM TOWER
          </Button>
        </div>
        {/* On a small screen the week's board has no card of its own: who wears the crown, and the way to the boards. */}
        <div className="mt-4 flex items-center gap-2.5 lg:hidden">
          {champion ? (
            <>
              <MemberAvatar member={members[champion.member_id]} size="sm" />
              <p className="min-w-0 flex-1 truncate text-xs text-navy-700">
                <span className="font-semibold text-navy-900">{nameOf(members, champion.member_id)}</span> porte la couronne
              </p>
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-xs text-navy-600">{leader ? `${nameOf(members, leader.member_id)} mène la semaine` : "La couronne attend son premier champion"}</p>
          )}
          <button type="button" onClick={onBoard} className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-semibold text-navy-800 hover:text-navy-900 focus-ring">
            LEADERBOARD <ArrowRight className="size-3.5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-navy-900/[0.08] pt-4 lg:mt-5">
          <Stat
            label="Mon record"
            value={boards ? (boards.me.best_score > 0 ? points(boards.me.best_score) : "—") : "…"}
            hint={boards && boards.me.best_floors > 0 ? `${boards.me.best_floors} étages` : "Pas encore de partie"}
          />
          <Stat
            label="Remise à zéro"
            value={`dans ${countdown(nextWeeklyReset(now), now)}`}
            hint="Lundi, 0 h (Montréal)"
          />
        </div>
      </Card>

      <Card data-tower-panel className="pointer-events-auto w-full max-lg:hidden lg:max-w-[340px]">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-sun-600" />
          <h2 className="text-[13px] font-semibold text-navy-900">Cette semaine</h2>
          <button type="button" onClick={onBoard} className="ml-auto inline-flex items-center gap-1 rounded-md text-xs font-medium text-navy-600 hover:text-navy-900 focus-ring">
            LEADERBOARD <ArrowRight className="size-3.5" />
          </button>
        </div>
        {champion && (
          <p className="mt-3 flex items-center gap-2.5 rounded-xl bg-sun-50 px-3 py-2 text-xs text-sun-800">
            <MemberAvatar member={members[champion.member_id]} size="md" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{nameOf(members, champion.member_id)} porte la couronne</span>
              <span className="block truncate">Champion de la semaine du {formatShortDate(parseDateOnly(champion.week_start))} · {points(champion.score)}</span>
            </span>
          </p>
        )}
        <ol className="mt-2.5 grid gap-0.5">
          {(boards?.week ?? []).slice(0, 4).map((row, i) => (
            <li key={row.member_id} className={cn("flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[13px]", row.member_id === meId && "bg-navy-900/[0.045]")}>
              <span className="w-5 text-center text-xs font-semibold text-navy-500 tabular">{i + 1}</span>
              <MemberAvatar member={members[row.member_id]} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{nameOf(members, row.member_id)}</span>
              <span className="font-semibold text-navy-900 tabular">{points(row.score)}</span>
            </li>
          ))}
        </ol>
        {boards && boards.week.length === 0 && <p className="mt-3 text-[13px] text-navy-600">Personne n&apos;a encore joué cette semaine. La place est libre.</p>}
        {boards && leader && mine === 0 && <p className="mt-2 text-xs text-navy-600">Vous n&apos;êtes pas encore au classement de la semaine.</p>}
      </Card>
    </div>
  );
}

/* ----------------------------------- HUD ---------------------------------- */

export function GameHud({
  hud,
  chase,
  muted,
  onPause,
  onMute,
}: {
  hud: Hud;
  /** What to chase right now, in words (« Plus que 200 points pour battre Maya ! »). */
  chase: { text: string; member: Member | null } | null;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
}) {
  const last = hud.last;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-4 pt-4 sm:pt-5">
        <p className="tower-score tabular" aria-live="off" data-testid="tower-score">
          {points(hud.score)}
        </p>
        <p className="tower-hud-line mt-0.5 flex items-center gap-2 text-[13px] font-semibold">
          <span data-testid="tower-floors">Étage {hud.floors}</span>
          {hud.multiplier > 1 && (
            <span key={hud.multiplier} className="tower-combo tabular" data-testid="tower-combo">
              x{hud.multiplier} COMBO
            </span>
          )}
        </p>
        {chase && (
          <p className="tower-hud-chip mt-2 flex max-w-full items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-medium" data-testid="tower-chase">
            {chase.member ? <MemberAvatar member={chase.member} size="xs" /> : <Trophy className="ml-1.5 size-3.5" />}
            <span className="truncate">{chase.text}</span>
          </p>
        )}
        {/* What the last crate was worth, said once, where the eye is. */}
        {last && last.kind !== "miss" && (
          <div key={last.n} className="tower-pop mt-3 flex flex-col items-center" aria-hidden="true">
            {last.kind === "perfect" && <PixelText text={last.multiplier >= 5 ? "Parfait x5" : "Parfait"} unit={2} className="tower-pop-title" />}
            <span className="tower-pop-points tabular">
              +{points(last.points)}
              {last.bonus > 0 && ` +${points(last.bonus)} bonus`}
            </span>
          </div>
        )}
      </div>
      {/* Before the first crate: how to let it go. */}
      {!last && hud.floors === 0 && (
        <p className="tower-hud-chip pointer-events-none absolute inset-x-0 bottom-6 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full px-4 py-2 text-center text-[13px] font-medium" data-testid="tower-hint">
          <span className="max-sm:hidden">Espace ou un clic : lâcher la caisse</span>
          <span className="sm:hidden">Touchez l&apos;écran pour lâcher la caisse</span>
        </p>
      )}
      <div className="absolute top-4 right-4 flex gap-1.5 sm:top-5 sm:right-5">
        <button type="button" onClick={onMute} aria-label={muted ? "Remettre le son" : "Couper le son"} aria-pressed={muted} className="tower-hud-button focus-ring">
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button type="button" onClick={onPause} aria-label="Pause" className="tower-hud-button focus-ring">
          <Pause className="size-4" />
        </button>
      </div>
      {/* For a screen reader: the score, said when it changes, without the animation. */}
      <p className="sr-only" role="status">
        {last ? `${last.kind === "perfect" ? "Parfait. " : last.kind === "cut" ? "Posée. " : ""}Étage ${hud.floors}, ${hud.score} points.` : "La caisse se balance : espace ou un toucher pour la lâcher."}
      </p>
    </>
  );
}

export function ZoneToast({ zone }: { zone: number }) {
  if (zone === 0) return null;
  return (
    <p key={zone} className="tower-zone pointer-events-none absolute inset-x-0 top-[34%] text-center" aria-hidden="true">
      <span>Étage {ZONES[zone].from}</span>
      {ZONES[zone].name}
    </p>
  );
}

export function PauseMenu({ onResume, onRestart, onQuit }: { onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-scrim/45 p-4">
      <Card role="dialog" aria-label="Pause" className="w-full max-w-[300px] p-5 text-center">
        <PixelText text="Pause" unit={3} className="mx-auto text-navy-900" />
        <div className="mt-5 grid gap-2">
          <Button size="lg" onClick={onResume} autoFocus>
            <Play /> RESUME
          </Button>
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw /> Recommencer
          </Button>
          <Button variant="ghost" onClick={onQuit}>
            Arrêter là
          </Button>
        </div>
        <p className="mt-3 text-xs text-navy-500">Espace ou un toucher : lâcher la caisse. P : pause. M : son.</p>
      </Card>
    </div>
  );
}

/* -------------------------------- game over ------------------------------- */

export interface RunEnd {
  seed: number;
  /** What the game itself counted, shown at once; the server's count replaces it when it arrives. */
  score: number;
  floors: number;
  combo: number;
  /** Null while the server is asked; an error says why the run does not count. */
  saved: TowerFinish | null;
  /** A run that could not be opened on the server: played for nothing but the fun. */
  unranked: string | null;
}

export function GameOver({
  end,
  onAgain,
  onBoard,
  onHome,
}: {
  end: RunEnd;
  onAgain: () => void;
  onBoard: () => void;
  onHome: () => void;
}) {
  const saved = end.saved?.ok ? end.saved : null;
  const score = saved?.score ?? end.score;
  // The card takes the focus, not a button: a second ago the space bar was dropping crates,
  // and it must not start a new game before the result has been seen. Enter plays again.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.focus();
  }, []);
  const record = !!saved && saved.score > saved.previous_best && saved.score > 0;
  const king = !!saved && saved.rank_week === 1 && saved.score > saved.week_record_before && saved.score >= saved.previous_week_best;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-4 sm:p-6 lg:items-center lg:justify-end lg:pr-[7%]">
      <Card ref={card} tabIndex={-1} data-tower-panel role="dialog" aria-label="Partie terminée" className="tower-over pointer-events-auto w-full max-w-[380px] p-5 text-center outline-none sm:p-6">
        <p className="text-[13px] font-medium text-navy-600" data-testid="tower-line">
          {king ? "KING OF TOMATOES 👑" : gameOverLine(end.seed, end.floors)}
        </p>
        <p className="tower-final mt-1 tabular" data-testid="tower-final">
          {points(score)}
        </p>
        {record && <p className="tower-record mx-auto mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold">NOUVEAU RECORD</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-navy-900/[0.08] py-3 text-left">
          <Stat label="Étages" value={saved?.floors ?? end.floors} />
          <Stat label="Combo" value={`x${saved?.best_combo ?? end.combo}`} />
          <Stat label="Semaine" value={saved ? ordinal(saved.rank_week) : end.unranked || end.saved ? "—" : "…"} />
        </div>
        <p className="mt-3 min-h-5 text-xs leading-relaxed text-navy-600" role="status">
          {end.unranked
            ? `Hors classement : ${end.unranked}`
            : !end.saved
              ? "Vérification du score…"
              : end.saved.ok
                ? record
                  ? `Votre ancien record était de ${points(end.saved.previous_best)}.`
                  : end.saved.previous_best > 0
                    ? `Votre record : ${points(end.saved.previous_best)}.`
                    : "Score enregistré."
                : end.saved.error}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={onAgain}>
            <RotateCcw /> PLAY AGAIN
          </Button>
          <Button size="lg" variant="outline" onClick={onBoard}>
            <Trophy /> LEADERBOARD
          </Button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-3 text-xs text-navy-600">
          <span className="max-sm:hidden">Entrée : rejouer</span>
          <button type="button" onClick={onHome} className="rounded-md font-medium hover:text-navy-900 focus-ring">
            Retour à l&apos;accueil du jeu
          </button>
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------- boards -------------------------------- */

type Tab = "week" | "all" | "me";

function Rows({ rows, members, meId, onBeat }: { rows: BoardRow[]; members: Members; meId: string | null; onBeat: (row: BoardRow) => void }) {
  if (rows.length === 0) return <p className="px-1 py-6 text-center text-[13px] text-navy-600">Rien ici pour le moment. À vous d&apos;ouvrir le bal.</p>;
  return (
    <ol className="flex flex-col gap-0.5">
      {rows.map((row, i) => {
        const mine = row.member_id === meId;
        return (
          <li key={row.member_id} className={cn("group flex items-center gap-2.5 rounded-xl px-2 py-2", mine && "bg-navy-900/[0.045]")}>
            <span className={cn("w-6 shrink-0 text-center text-[13px] font-semibold tabular", i === 0 ? "text-sun-600" : "text-navy-500")}>{i + 1}</span>
            <MemberAvatar member={members[row.member_id]} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-navy-900">
                {members[row.member_id]?.full_name ?? "Ancien membre"}
                {mine && <span className="ml-1.5 text-[11px] font-medium text-navy-500">vous</span>}
              </span>
              <span className="block truncate text-xs text-navy-600">
                {row.floors} étages · combo x{row.best_combo} · {row.runs} {row.runs > 1 ? "parties" : "partie"}
              </span>
            </span>
            <span className="text-[15px] font-semibold text-navy-900 tabular">{points(row.score)}</span>
            {!mine && (
              <Button size="sm" variant="outline" onClick={() => onBeat(row)} aria-label={`Battre le score de ${nameOf(members, row.member_id)}`} className="max-sm:hidden">
                BEAT THIS SCORE
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Boards({
  boards,
  members,
  meId,
  now,
  tab,
  onTab,
  onBeat,
  onPlay,
  onClose,
}: {
  boards: TowerBoards | null;
  members: Members;
  meId: string | null;
  now: Date;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onBeat: (row: BoardRow) => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "week", label: "THIS WEEK" },
    { key: "all", label: "ALL TIME" },
    { key: "me", label: "MY STATS" },
  ];
  const me = boards?.me;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 sm:p-6 lg:items-stretch">
      <Card data-tower-panel className="pointer-events-auto flex max-h-[64%] w-full flex-col p-0 lg:max-h-full lg:max-w-[460px]">
        <div className="flex items-center gap-2 px-5 pt-4">
          <Trophy className="size-4 text-sun-600" />
          <h2 className="text-[15px] font-semibold text-navy-900">Leaderboard</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Fermer le classement" onClick={onClose} className="-mr-2 ml-auto text-navy-500">
            <X />
          </Button>
        </div>
        <div role="tablist" aria-label="Classements" className="mt-3 flex gap-1 border-b border-navy-900/[0.08] px-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={cn(
                "relative h-9 rounded-t-lg px-2.5 text-xs font-semibold tracking-wide transition-colors focus-ring",
                tab === t.key ? "text-navy-900" : "text-navy-500 hover:text-navy-800",
              )}
            >
              {t.label}
              {tab === t.key && <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-tomato-600" />}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {!boards ? (
            <div className="grid gap-2 p-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-navy-900/[0.05]" />
              ))}
            </div>
          ) : tab === "week" ? (
            <>
              <p className="px-2 pb-2 text-xs text-navy-600">
                Semaine du {formatShortDate(parseDateOnly(boards.week_start))} · remise à zéro dans {countdown(nextWeeklyReset(now), now)} (lundi 0 h, Montréal)
              </p>
              <Rows rows={boards.week} members={members} meId={meId} onBeat={onBeat} />
              {boards.champions.length > 0 && (
                <div className="mt-4 border-t border-navy-900/[0.08] px-2 pt-3">
                  <h3 className="text-xs font-semibold text-navy-900">Les semaines d&apos;avant</h3>
                  <ul className="mt-1.5 grid gap-1">
                    {boards.champions.slice(0, 6).map((c) => (
                      <li key={c.week_start} className="flex items-center gap-2 text-xs text-navy-700">
                        <MemberAvatar member={members[c.member_id]} size="xs" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-navy-900">{nameOf(members, c.member_id)}</span> · semaine du {formatShortDate(parseDateOnly(c.week_start))}
                        </span>
                        <span className="font-semibold tabular">{points(c.score)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : tab === "all" ? (
            <Rows rows={boards.all_time} members={members} meId={meId} onBeat={onBeat} />
          ) : me && me.runs > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-2">
              <Stat label="Record" value={points(me.best_score)} hint={`${me.best_floors} étages`} />
              <Stat label="Cette semaine" value={rankOf(boards.week, meId) ? ordinal(rankOf(boards.week, meId)) : "—"} hint={rankOf(boards.week, meId) ? `${points(boards.week[rankOf(boards.week, meId) - 1].score)} points` : "Pas encore joué"} />
              <Stat label="Parties" value={me.runs} hint={`${points(me.average_score)} en moyenne`} />
              <Stat label="Étages posés" value={points(me.total_floors)} hint={`${points(me.perfects)} parfaits`} />
              <Stat label="Meilleur combo" value={`x${me.best_combo}`} hint={`${me.best_streak} parfaits d'affilée`} />
              <Stat label="Semaines gagnées" value={me.weeks_won} hint={me.weeks_won > 0 ? "La couronne vous va bien" : "La couronne attend"} />
            </div>
          ) : (
            <p className="px-1 py-6 text-center text-[13px] text-navy-600">Vos chiffres apparaîtront après votre première partie.</p>
          )}
        </div>
        <div className="border-t border-navy-900/[0.08] p-3">
          <Button className="w-full" onClick={onPlay}>
            <Gamepad /> PLAY NOW
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------- team tower ------------------------------ */

export function TeamPanel({
  view,
  members,
  meId,
  now,
  aiming,
  busy,
  note,
  onAim,
  onHoldBack,
  onClose,
}: {
  view: TeamTowerView | null;
  members: Members;
  meId: string | null;
  now: Date;
  /** My crate is swinging: the panel steps aside and says what to do. */
  aiming: boolean;
  busy: boolean;
  /** What just happened to my crate, in words. */
  note: string | null;
  onAim: () => void;
  /** Not now after all: the crate is kept for later today. */
  onHoldBack: () => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (aiming) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[68px] flex flex-col items-center gap-2 px-4 lg:top-5">
        <p className="tower-hud-chip rounded-full px-4 py-2 text-center text-[13px] font-medium" role="status">
          {busy ? "La caisse descend…" : "Votre caisse du jour : espace ou un toucher pour la lâcher."}
        </p>
        {!busy && (
          <button type="button" onClick={onHoldBack} className="tower-hud-chip pointer-events-auto rounded-full px-3 py-1 text-xs font-medium focus-ring">
            Pas maintenant
          </button>
        )}
      </div>
    );
  }
  const stats = view?.stats;
  const today = view ? view.crates.filter((c) => c.day === view.today) : [];
  const crates = view ? [...view.crates].reverse() : [];
  const fallen = !!view && !view.tower;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 sm:p-6 lg:items-stretch">
      <Card data-tower-panel className="pointer-events-auto flex max-h-[60%] w-full flex-col p-0 lg:max-h-full lg:max-w-[420px]">
        <div className="flex items-center gap-2 px-5 pt-4">
          <Users className="size-4 text-teal-600" />
          <h2 className="text-[15px] font-semibold text-navy-900">Team Tower</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Fermer la tour d'équipe" onClick={onClose} className="-mr-2 ml-auto text-navy-500">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-4">
          <p className="text-[13px] leading-relaxed text-navy-600">
            Une seule tour pour toute l&apos;équipe, une caisse par personne et par jour. Une caisse de travers laisse moins de place à la suivante ; une caisse à côté, et tout tombe.
          </p>
          {!view ? (
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-navy-900/[0.05]" aria-busy="true" />
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Hauteur" value={fallen ? "0" : view.tower!.height} hint={fallen ? "Tombée" : `depuis le ${formatShortDate(parseDateOnly(view.tower!.started_on))}`} />
                <Stat label="Record" value={stats!.record_height} hint={stats!.record_on ? formatShortDate(parseDateOnly(stats!.record_on)) : undefined} />
                <Stat label="Aujourd'hui" value={today.filter((c) => c.kind !== "miss").length} hint={today.length ? today.map((c) => nameOf(members, c.member_id)).join(", ") : "Personne encore"} />
              </div>

              <div className="mt-4 rounded-xl bg-navy-900/[0.045] px-3.5 py-3 text-[13px] leading-relaxed text-navy-800" role="status" data-testid="team-status">
                {note ? (
                  note
                ) : fallen ? (
                  <>
                    <strong className="font-semibold">La tour est morte. Vive la tour.</strong> {nameOf(members, view.fallen_by)} a posé la caisse de trop. Une nouvelle tour commence
                    dans {countdown(nextTowerDay(now), now)}.
                  </>
                ) : view.played_today ? (
                  <>Votre caisse du jour est posée. La prochaine dans {countdown(nextTowerDay(now), now)}.</>
                ) : (
                  <>C&apos;est votre tour : une caisse, une seule chance aujourd&apos;hui.</>
                )}
              </div>
              {!fallen && !view.played_today && (
                <Button size="lg" className="mt-3 w-full" onClick={onAim} disabled={busy}>
                  <Play /> POSER MA CAISSE
                </Button>
              )}

              <h3 className="mt-5 text-xs font-semibold text-navy-900">L&apos;équipe à l&apos;ouvrage</h3>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-navy-700">
                <div className="flex justify-between gap-2">
                  <dt>Caisses posées</dt>
                  <dd className="font-semibold text-navy-900 tabular">{stats!.total_crates}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Tours bâties</dt>
                  <dd className="font-semibold text-navy-900 tabular">{stats!.towers}</dd>
                </div>
                <div className="col-span-2 flex justify-between gap-2">
                  <dt>Meilleure journée</dt>
                  <dd className="font-semibold text-navy-900">
                    {stats!.best_day ? `${formatShortDate(parseDateOnly(stats!.best_day))} · ${stats!.best_day_crates} caisses` : "—"}
                  </dd>
                </div>
                <div className="col-span-2 flex justify-between gap-2">
                  <dt>Dernière caisse</dt>
                  <dd className="truncate font-semibold text-navy-900">
                    {stats!.last ? `${nameOf(members, stats!.last.member_id)}, ${relativeTime(stats!.last.placed_at, now)}` : "—"}
                  </dd>
                </div>
              </dl>
              <ul className="mt-3 grid gap-1">
                {stats!.contributors.map((c) => (
                  <li key={c.member_id} className={cn("flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px]", c.member_id === meId && "bg-navy-900/[0.045]")}>
                    <MemberAvatar member={members[c.member_id]} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{members[c.member_id]?.full_name ?? "Ancien membre"}</span>
                    <span className="text-xs text-navy-600 tabular">
                      {c.crates} {c.crates > 1 ? "caisses" : "caisse"} · {c.perfects} {c.perfects > 1 ? "parfaits" : "parfait"}
                    </span>
                  </li>
                ))}
              </ul>

              {crates.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs font-semibold text-navy-900">{fallen ? "La tour tombée, étage par étage" : "La tour, étage par étage"}</h3>
                  <ol className="mt-1.5 grid gap-0.5" reversed>
                    {(showAll ? crates : crates.slice(0, 6)).map((c) => (
                      <li key={c.floor} className="flex items-center gap-2 px-1.5 py-1 text-xs text-navy-700">
                        <span className="w-6 text-right font-semibold text-navy-500 tabular">{c.floor}</span>
                        <MemberAvatar member={c.member_id ? members[c.member_id] : null} size="xs" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-navy-900">{nameOf(members, c.member_id)}</span> · {formatShortDate(parseDateOnly(c.day))}
                        </span>
                        <span className={cn("font-medium", c.kind === "perfect" ? "text-leaf-600" : c.kind === "miss" ? "text-coral-600" : "text-navy-600")}>
                          {c.kind === "perfect" ? "parfait" : c.kind === "miss" ? "à côté" : "posée"}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {crates.length > 6 && !showAll && (
                    <button type="button" onClick={() => setShowAll(true)} className="mt-1 rounded-md px-1.5 text-xs font-medium text-navy-600 hover:text-navy-900 focus-ring">
                      Voir les {crates.length - 6} étages du dessous
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
