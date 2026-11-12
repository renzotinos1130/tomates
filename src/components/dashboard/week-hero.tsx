"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { StatusIcon } from "@/components/kit/status-icon";
import { TaskLine } from "@/components/tasks/task-line";
import { formatWeekRange, parseDateOnly, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow, useWeek, useWeekPriorities } from "@/lib/hooks";
import { atRiskTasks, weeklyDone, type WeekCount } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Figure } from "./figure";
import { HARVEST_ORDER, Potager, StatusTomato } from "./potager";
import { useFitRows } from "./use-fit-rows";
import { WeekBars } from "./week-bars";

/** The three ways of looking at the team's week, in the order of their tabs. */
type View = "priorities" | "risk" | "done";
const VIEWS: View[] = ["priorities", "risk", "done"];

const HELP: Record<View, string> = {
  priorities: "Les priorités de la semaine, choisies au meeting du mercredi. Une tomate chacune : elle mûrit avec son statut.",
  risk: "Ce qui est bloqué ou en retard, dans toute l'équipe.",
  done: "Ce que l'équipe a terminé depuis mercredi.",
};

/** A status as the legend of the patch words it, singular and plural. */
const LEGEND: Record<TaskStatus, [string, string]> = {
  done: ["terminée", "terminées"],
  review: ["en validation", "en validation"],
  in_progress: ["en cours", "en cours"],
  blocked: ["bloquée", "bloquées"],
  todo: ["à faire", "à faire"],
};

/** The rows of a view: they share the height of the tile, in whole rows. */
function Rows({ tasks, more = 0, strike = true }: { tasks: Task[]; more?: number; strike?: boolean }) {
  const rows = useFitRows<HTMLDivElement>();
  return (
    <div ref={rows} className="gw-rows gw-fit min-w-0 flex-1 [--fit-row:56px]">
      {tasks.map((t) => (
        <TaskLine key={t.id} task={t} show={{ lead: "status", status: false, strike }} className="min-h-11 hover:bg-white/35" />
      ))}
      {more > 0 && <p className="px-2.5 py-2 text-xs text-navy-600">et {more} de plus</p>}
    </div>
  );
}

/** What a view says when it has nothing to list. */
function Nothing({ stage, children }: { stage: number; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
      <PixelTomato size={48} stage={stage} decorative />
      <p className="max-w-[340px] text-[13px] leading-5 text-navy-600">{children}</p>
    </div>
  );
}

/** The score of the priorities, the tomato patch and its legend. */
function PrioritiesScore({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === "done").length;
  const legend = HARVEST_ORDER.map((status) => ({ status, count: tasks.filter((t) => t.status === status).length })).filter(
    (l) => l.count > 0,
  );
  return (
    <>
      <div>
        <p className="flex items-baseline gap-1.5">
          <Figure value={done} className="week-figure" />
          <span className="week-total tabular">/{tasks.length}</span>
        </p>
        <p className="mt-2 text-[13px] text-navy-700">{done >= 2 ? "priorités terminées" : "priorité terminée"}</p>
      </div>
      <Potager tasks={tasks} />
      <ul className="week-legend" aria-label="Répartition des priorités">
        {legend.map((l) => (
          <li key={l.status} className="flex items-center gap-2 text-xs text-navy-700">
            <StatusTomato status={l.status} size={16} />
            <span>
              <span className="font-medium text-navy-900 tabular">{l.count}</span> {LEGEND[l.status][l.count >= 2 ? 1 : 0]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** How many tasks need a hand, and of which kind. The one figure drawn in red: it asks for something. */
function RiskScore({ total, blocked, late }: { total: number; blocked: number; late: number }) {
  return (
    <>
      <div>
        <p>
          <Figure value={total} className={cn("week-figure", total > 0 && "text-tomato-700")} />
        </p>
        <p className="mt-2 text-[13px] text-navy-700">{total >= 2 ? "tâches à débloquer" : "tâche à débloquer"}</p>
      </div>
      {/* Two groups that add up to the figure: a blocked task that is also late counts as blocked. */}
      <ul className="week-legend" aria-label="Répartition des tâches à débloquer">
        {blocked > 0 && (
          <li className="flex items-center gap-2 text-xs text-navy-700">
            <StatusIcon status="blocked" size={16} />
            <span>
              <span className="font-medium text-navy-900 tabular">{blocked}</span> {blocked >= 2 ? "bloquées" : "bloquée"}
            </span>
          </li>
        )}
        {late > 0 && (
          <li className="flex items-center gap-2 text-xs text-navy-700">
            <Clock className="size-4 text-coral-600" strokeWidth={1.9} aria-hidden="true" />
            <span>
              <span className="font-medium text-navy-900 tabular">{late}</span> en retard
            </span>
          </li>
        )}
      </ul>
    </>
  );
}

/** What was finished this week, against the five weeks before. */
function DoneScore({ weeks }: { weeks: WeekCount[] }) {
  const current = weeks[weeks.length - 1]?.done ?? 0;
  const previous = weeks[weeks.length - 2]?.done ?? 0;
  return (
    <>
      <div>
        <p>
          <Figure value={current} className="week-figure" />
        </p>
        <p className="mt-2 text-[13px] text-navy-700">{current >= 2 ? "terminées cette semaine" : "terminée cette semaine"}</p>
        <p className="mt-1 text-xs text-navy-600">{previous === 0 ? "Aucune" : previous} la semaine dernière</p>
      </div>
      <WeekBars weeks={weeks} />
    </>
  );
}

/**
 * The tile the page is built around: the team's week, seen three ways. The
 * priorities (their score, a tomato per priority, the list), what needs
 * unblocking, and what was finished. Each view leads with its figure; the
 * tabs carry the three counts, so the page tells them without a click.
 *
 * The three views are laid on top of one another and only one shows: the tile
 * keeps the height of the tallest, and the page does not jump when the view
 * changes. On a narrow tile they follow one another instead (see `.week-views`).
 */
export function WeekHero({ className, delay = 0 }: { className?: string; delay?: number }) {
  const heading = useId();
  const now = useNow();
  const week = useWeek();
  const today = todayDateOnly(now);
  const all = useAllTasks();
  const { ordered } = useWeekPriorities();
  const tasksMap = useApp((s) => s.tasks);
  const [view, setView] = useState<View>("priorities");
  // Once a view has been chosen, what arrives in it no longer waits for the tile to come in.
  const [chosen, setChosen] = useState(false);

  const priorities = useMemo(
    () => ordered.map((id) => tasksMap[id]).filter((t): t is Task => !!t && !t.archived_at),
    [ordered, tasksMap],
  );
  // Open first, finished at the bottom.
  const sorted = useMemo(
    () => [...priorities].sort((a, b) => Number(a.status === "done") - Number(b.status === "done")),
    [priorities],
  );
  const risky = useMemo(() => atRiskTasks(all, today), [all, today]);
  const blocked = risky.filter((t) => t.status === "blocked").length;
  const finished = useMemo(
    () =>
      all
        .filter((t) => t.status === "done" && t.completed_at && t.completed_at >= week.startIso)
        .sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? 1 : -1)),
    [all, week.startIso],
  );
  // Recomputed when the day changes, not every half minute.
  const weeks = useMemo(() => weeklyDone(all, parseDateOnly(today)), [all, today]);
  // The priorities give the tile its height; the other two views list no more rows than they do.
  const room = Math.max(priorities.length, 6);

  const tabs: Record<View, { label: string; count: number; alert?: boolean }> = {
    priorities: { label: "Priorités", count: priorities.length },
    risk: { label: "À débloquer", count: risky.length, alert: risky.length > 0 },
    done: { label: "Terminées", count: finished.length },
  };
  const buttons = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const choose = (v: View) => {
    setView(v);
    setChosen(true);
  };
  // The arrows move between the tabs, as in any tab list; Tab leaves it for the view.
  const onKeyDown = (e: KeyboardEvent) => {
    const i = VIEWS.indexOf(view);
    const next =
      e.key === "ArrowRight"
        ? VIEWS[(i + 1) % VIEWS.length]
        : e.key === "ArrowLeft"
          ? VIEWS[(i + VIEWS.length - 1) % VIEWS.length]
          : e.key === "Home"
            ? VIEWS[0]
            : e.key === "End"
              ? VIEWS[VIEWS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    choose(next);
    buttons.current[next]?.focus();
  };
  /** What a view needs to be a tab panel: its name, its tab, and out of reach when it is not the one shown. */
  const panel = (v: View) => ({
    role: "tabpanel" as const,
    id: `${heading}-${v}`,
    "aria-labelledby": `${heading}-${v}-tab`,
    "data-state": view === v ? "active" : "inactive",
    inert: view !== v,
    className: "week-body",
  });
  /** A view's score is redrawn when the view is shown: its figure counts, its tomatoes pop. */
  const scoreKey = (v: View) => (view === v ? "shown" : "hidden");

  return (
    <section
      className={cn("gw-panel gw-reveal @container/panel flex flex-col", className)}
      style={{ animationDelay: `${delay}ms` }}
      aria-labelledby={heading}
      data-chosen={chosen ? "" : undefined}
    >
      <h2 id={heading} className="sr-only">
        La semaine de l&apos;équipe
      </h2>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <div role="tablist" aria-label="La semaine de l'équipe" className="week-tabs" onKeyDown={onKeyDown}>
          {VIEWS.map((v) => (
            <button
              key={v}
              ref={(el) => {
                buttons.current[v] = el;
              }}
              type="button"
              role="tab"
              id={`${heading}-${v}-tab`}
              aria-selected={view === v}
              aria-controls={`${heading}-${v}`}
              tabIndex={view === v ? 0 : -1}
              data-state={view === v ? "active" : "inactive"}
              onClick={() => choose(v)}
              className="week-tab focus-ring"
            >
              {tabs[v].label}
              <span className="week-tab-count tabular" data-alert={tabs[v].alert ? "" : undefined}>
                {tabs[v].count}
              </span>
            </button>
          ))}
        </div>
        <span className="hidden shrink-0 text-xs text-navy-600 @3xl/panel:inline">Semaine du {formatWeekRange(now)}</span>
      </div>
      <p className="mb-5 text-xs leading-4 text-navy-600">{HELP[view]}</p>

      <div className="week-views">
        <div {...panel("priorities")}>
          {priorities.length === 0 ? (
            <Nothing stage={0}>
              Aucune priorité pour l&apos;instant. Elles se choisissent pendant le{" "}
              <Link href="/meeting" className="font-medium text-navy-900 underline decoration-navy-900/25 underline-offset-2 hover:decoration-navy-900">
                meeting du mercredi
              </Link>
              .
            </Nothing>
          ) : (
            <>
              <div className="week-score" key={scoreKey("priorities")}>
                <PrioritiesScore tasks={priorities} />
              </div>
              <Rows tasks={sorted} />
            </>
          )}
        </div>

        <div {...panel("risk")}>
          <div className="week-score" key={scoreKey("risk")}>
            <RiskScore total={risky.length} blocked={blocked} late={risky.length - blocked} />
          </div>
          {risky.length === 0 ? (
            <Nothing stage={3}>Rien ne coince : aucune tâche bloquée ni en retard.</Nothing>
          ) : (
            <Rows tasks={risky.slice(0, room)} more={Math.max(0, risky.length - room)} />
          )}
        </div>

        <div {...panel("done")}>
          <div className="week-score" key={scoreKey("done")}>
            <DoneScore weeks={weeks} />
          </div>
          {finished.length === 0 ? (
            <Nothing stage={1}>Rien de terminé pour l&apos;instant cette semaine. Elle a commencé mercredi.</Nothing>
          ) : (
            <Rows tasks={finished.slice(0, room)} more={Math.max(0, finished.length - room)} strike={false} />
          )}
        </div>
      </div>
    </section>
  );
}
