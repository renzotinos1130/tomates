"use client";

import { Clock } from "@/components/kit/icons";
import Link from "next/link";
import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { DueLabel } from "@/components/kit/pills";
import { PixelTomato, RIPENESS_STAGES, ripenessStage } from "@/components/kit/pixel-tomato";
import { StatusIcon } from "@/components/kit/status-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/constants";
import { formatWeekRange, parseDateOnly, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMe, useMembers, useNow, useWeek, useWeekPriorities } from "@/lib/hooks";
import { atRiskTasks, weeklyDone, type WeekCount } from "@/lib/selectors";
import { ui, useApp } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import type { Member, Task, TaskStatus } from "@/lib/types";
import { cn, firstName, plural } from "@/lib/utils";
import { Figure } from "./figure";
import { HARVEST_ORDER, Potager, StatusTomato } from "./potager";
import { WeekBars } from "./week-bars";

/** The three ways of looking at the team's week, in the order of their tabs. */
type View = "priorities" | "risk" | "done";
const VIEWS: View[] = ["priorities", "risk", "done"];
type Lists = Record<View, Task[]>;

/** What a card says when its owner has nothing in a view. */
const NONE: Record<View, string> = {
  priorities: "Pas de priorité cette semaine.",
  risk: "Rien ne coince.",
  done: "Rien pour l'instant.",
};
/** No more than this many tasks on a card; the rest is a count. */
const ROOM = 4;
/** The open statuses, in the order of the load bar at the foot of a card. */
const LOAD_ORDER = ["in_progress", "review", "blocked", "todo"] as const;
type Load = Record<(typeof LOAD_ORDER)[number], number>;

/** A status as the legend of the patch words it, singular and plural. */
const LEGEND: Record<TaskStatus, [string, string]> = {
  done: ["terminée", "terminées"],
  review: ["en validation", "en validation"],
  in_progress: ["en cours", "en cours"],
  blocked: ["bloquée", "bloquées"],
  todo: ["à faire", "à faire"],
};

/** One task on a card: its mark, its title, its date when it matters. A click opens it. */
function Chip({ task, view, today, now }: { task: Task; view: View; today: string; now: Date }) {
  const late = isOverdue(task, today);
  return (
    <li>
      <button
        type="button"
        onClick={() => ui.openTask(task.id)}
        aria-label={`${task.title} : ${STATUS_META[task.status].label}`}
        className="lineup-chip focus-ring"
      >
        <span className="mt-px shrink-0">
          {view === "priorities" ? (
            // A priority is a tomato, here as in the patch.
            <StatusTomato status={task.status} size={16} />
          ) : view === "risk" && task.status !== "blocked" ? (
            <Clock className="size-4 text-coral-600" strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <StatusIcon status={task.status} />
          )}
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "line-clamp-3 text-[13px] leading-snug",
              view === "priorities" && task.status === "done" ? "text-navy-400 line-through decoration-navy-200" : "font-medium text-navy-900",
            )}
          >
            {task.title}
          </span>
          {view !== "done" && task.status !== "done" && task.due_date && (late || view === "risk") && (
            <DueLabel date={task.due_date} now={now} className="mt-0.5 text-[11.5px]" />
          )}
        </span>
      </button>
    </li>
  );
}

/** The score of the priorities, the tomato patch and its legend. */
function PrioritiesScore({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === "done").length;
  const legend = HARVEST_ORDER.map((status) => ({ status, count: tasks.filter((t) => t.status === status).length })).filter(
    (l) => l.count > 0,
  );
  if (tasks.length === 0) {
    return (
      <p className="text-[13px] leading-5 text-navy-600">
        Aucune priorité pour l&apos;instant. Elles se choisissent pendant le{" "}
        <Link href="/meeting" className="font-medium text-navy-900 underline decoration-navy-900/25 underline-offset-2 hover:decoration-navy-900">
          meeting hebdomadaire
        </Link>
        .
      </p>
    );
  }
  return (
    <>
      <div>
        <p className="flex items-baseline justify-center gap-1.5">
          <Figure value={done} className="week-figure" />
          <span className="week-total tabular">/{tasks.length}</span>
        </p>
        <p className="mt-2 text-[13px] text-navy-700">{done >= 2 ? "priorités terminées" : "priorité terminée"}</p>
      </div>
      <Potager tasks={tasks} />
      <ul className="week-legend" aria-label="Répartition des priorités">
        {legend.map((l) => (
          <li key={l.status} className="flex items-center gap-1.5 text-xs text-navy-700">
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
      {total > 0 ? (
        <ul className="week-legend" aria-label="Répartition des tâches à débloquer">
          {blocked > 0 && (
            <li className="flex items-center gap-1.5 text-xs text-navy-700">
              <StatusIcon status="blocked" size={16} />
              <span>
                <span className="font-medium text-navy-900 tabular">{blocked}</span> {blocked >= 2 ? "bloquées" : "bloquée"}
              </span>
            </li>
          )}
          {late > 0 && (
            <li className="flex items-center gap-1.5 text-xs text-navy-700">
              <Clock className="size-4 text-coral-600" strokeWidth={1.9} aria-hidden="true" />
              <span>
                <span className="font-medium text-navy-900 tabular">{late}</span> en retard
              </span>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-navy-600">Aucune tâche bloquée ni en retard.</p>
      )}
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

/** A partner's card: the face above it, the name, the load, and what the chosen view holds for them. */
function PersonCard({
  member,
  isMe,
  online,
  open,
  load: carried,
  lists,
  view,
  delay,
  today,
  now,
}: {
  /** Null: the card of the tasks nobody carries yet. */
  member: Member | null;
  isMe: boolean;
  online: boolean;
  open: number;
  /** The open tasks by status: what the bar at the foot of the card is made of. */
  load: Load | null;
  lists: Lists;
  view: View;
  delay: number;
  today: string;
  now: Date;
}) {
  const name = member ? firstName(member.full_name) : "Sans responsable";
  const load = plural(open, "tâche ouverte", "tâches ouvertes");
  const stretches = carried
    ? LOAD_ORDER.filter((status) => carried[status] > 0).map((status) => ({
        status,
        count: carried[status],
        words: `${carried[status]} ${LEGEND[status][carried[status] >= 2 ? 1 : 0]}`,
      }))
    : [];
  const identity = (
    <>
      <span className="lineup-head">
        <MemberAvatar
          member={member}
          size="2xl"
          online={member ? online : undefined}
          className={cn(
            "size-[var(--face)] bg-white/80 shadow-[0_14px_28px_-16px_rgb(13_27_51/0.5)] ring-[3px] transition-transform duration-300 group-hover/id:scale-[1.05]",
            // Me: the face is ringed in tomato.
            isMe ? "ring-tomato-500" : "ring-white/90",
          )}
        />
      </span>
      <h3 className="flex max-w-full items-center justify-center gap-1.5 text-[15px] leading-5 font-semibold tracking-[-0.01em] text-navy-900">
        <span className="truncate">{name}</span>
        {/* Shorter than the line it sits on: my card lines up with the others. */}
        {isMe && (
          <span className="shrink-0 rounded-[5px] bg-navy-900/[0.07] px-1.5 py-px text-[10.5px] leading-4 font-medium text-navy-700">vous</span>
        )}
      </h3>
      <p className="mt-0.5 text-xs text-navy-600 tabular">{member ? load : "À confier à quelqu'un"}</p>
    </>
  );

  return (
    <section
      className="gw-panel gw-reveal lineup-card @container/panel"
      style={{ animationDelay: `${delay}ms` }}
      aria-label={member ? member.full_name : name}
    >
      {member ? (
        <Link
          href={isMe ? "/mes-taches" : `/mes-taches?membre=${member.id}`}
          aria-label={`${member.full_name} : ${load}. Voir ses tâches`}
          className="group/id lineup-id focus-ring"
        >
          {identity}
        </Link>
      ) : (
        <div className="lineup-id">{identity}</div>
      )}
      <div className="lineup-stack">
        {VIEWS.map((v) => (
          <ul key={v} data-state={view === v ? "active" : "inactive"} inert={view !== v} className="lineup-list">
            {lists[v].length === 0 ? (
              <li className="px-1.5 py-1 text-xs leading-5 text-navy-600">{NONE[v]}</li>
            ) : (
              <>
                {lists[v].slice(0, ROOM).map((t) => (
                  <Chip key={t.id} task={t} view={v} today={today} now={now} />
                ))}
                {lists[v].length > ROOM && <li className="px-1.5 pt-1 text-xs text-navy-600">et {lists[v].length - ROOM} de plus</li>}
              </>
            )}
          </ul>
        ))}
      </div>
      {/* What the open tasks are made of: one stretch of the bar per status, named under the pointer. */}
      {stretches.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="lineup-load" role="img" aria-label={`Charge : ${stretches.map((s) => s.words).join(", ")}`}>
              {stretches.map((s) => (
                <i key={s.status} data-status={s.status} style={{ flexGrow: s.count }} />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={-4} className="flex-col items-start gap-1 py-2">
            {stretches.map((s) => (
              <span key={s.status} className="flex items-center gap-2">
                <i className="load-key" data-status={s.status} />
                {s.words}
              </span>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </section>
  );
}

/**
 * The team's week, as a line-up: the tomato of the week first (its ripeness
 * is the week's progress, its card holds the score), then a card per partner,
 * the face standing above it. Three tabs change what every card shows: the
 * priorities, what needs unblocking, what was finished. The tabs carry the
 * three counts, so the page says them without a click.
 *
 * Every card keeps its three lists on top of one another and shows one: the
 * cards do not change height when the view changes.
 */
export function WeekLineup({ delay = 0 }: { delay?: number }) {
  const heading = useId();
  const now = useNow();
  const week = useWeek();
  const today = todayDateOnly(now);
  const me = useMe();
  const members = useMembers();
  const all = useAllTasks();
  const presence = useApp((s) => s.presence);
  const { ordered } = useWeekPriorities();
  const tasksMap = useApp((s) => s.tasks);
  const [view, setView] = useState<View>("priorities");
  // Once a view has been chosen, what arrives in it no longer waits for the cards to come in.
  const [chosen, setChosen] = useState(false);

  const priorities = useMemo(
    () => ordered.map((id) => tasksMap[id]).filter((t): t is Task => !!t && !t.archived_at),
    [ordered, tasksMap],
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
  const online = useMemo(() => new Set(presence.map((p) => p.member_id)), [presence]);
  const load = useMemo(() => {
    const byMember = new Map<string, Load>();
    for (const t of all) {
      if (!isOpen(t) || !t.assignee_id || t.status === "done") continue;
      const mine = byMember.get(t.assignee_id) ?? { in_progress: 0, review: 0, blocked: 0, todo: 0 };
      mine[t.status]++;
      byMember.set(t.assignee_id, mine);
    }
    return byMember;
  }, [all]);
  const openOf = (id: string) => {
    const mine = load.get(id);
    return mine ? LOAD_ORDER.reduce((n, s) => n + mine[s], 0) : 0;
  };

  /** What each view holds for one person (null: nobody). Open priorities first, finished ones last. */
  const listsOf = (id: string | null): Lists => ({
    priorities: priorities
      .filter((t) => (t.assignee_id ?? null) === id)
      .sort((a, b) => Number(a.status === "done") - Number(b.status === "done")),
    risk: risky.filter((t) => (t.assignee_id ?? null) === id),
    done: finished.filter((t) => (t.assignee_id ?? null) === id),
  });
  const orphans = listsOf(null);
  const hasOrphans = VIEWS.some((v) => orphans[v].length > 0);

  const done = priorities.filter((t) => t.status === "done").length;
  const stage = ripenessStage(done, priorities.length);
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
  // The arrows move between the tabs, as in any tab list; Tab leaves it for the cards.
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
  /** A view's score is redrawn when the view is shown: its figure counts, its tomatoes pop. */
  const score = (v: View) => ({
    "data-state": view === v ? "active" : "inactive",
    inert: view !== v,
    className: "lineup-score-view",
  });
  const shown = (v: View) => `${v}-${view === v ? "shown" : "hidden"}`;
  const people = members.length + (hasOrphans ? 1 : 0);

  return (
    <section className="dash-week" aria-labelledby={heading} data-chosen={chosen ? "" : undefined}>
      <div className="dash-week-head">
        <h2 id={heading} className="dash-title">
          La semaine de l&apos;équipe
        </h2>
        <div role="tablist" aria-label="La semaine de l'équipe" className="week-tabs dash-pill" onKeyDown={onKeyDown}>
          {VIEWS.map((v) => (
            <button
              key={v}
              ref={(el) => {
                buttons.current[v] = el;
              }}
              type="button"
              role="tab"
              id={`${heading}-${v}`}
              aria-selected={view === v}
              aria-controls={`${heading}-panel`}
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
      </div>

      <div
        role="tabpanel"
        id={`${heading}-panel`}
        aria-labelledby={`${heading}-${view}`}
        className="lineup"
        style={{ "--people": Math.min(6, Math.max(1, people)) } as CSSProperties}
      >
        {/* The tomato of the week: as ripe as the week is far along. Its card holds the score. */}
        <section className="gw-panel gw-reveal lineup-card lineup-score @container/panel" style={{ animationDelay: `${delay}ms` }} aria-label="Le score de la semaine">
          <span className="lineup-head">
            <PixelTomato
              size={96}
              stage={stage}
              className="lineup-mascot"
              title={`Tomate ${RIPENESS_STAGES[stage]} : ${done} sur ${plural(priorities.length, "priorité")} ${done >= 2 ? "terminées" : "terminée"}`}
            />
          </span>
          <p className="text-xs text-navy-600">Semaine du {formatWeekRange(now)}</p>
          <div className="lineup-stack">
            <div key={shown("priorities")} {...score("priorities")}>
              <PrioritiesScore tasks={priorities} />
            </div>
            <div key={shown("risk")} {...score("risk")}>
              <RiskScore total={risky.length} blocked={blocked} late={risky.length - blocked} />
            </div>
            <div key={shown("done")} {...score("done")}>
              <DoneScore weeks={weeks} />
            </div>
          </div>
        </section>

        {members.map((m, i) => (
          <PersonCard
            key={m.id}
            member={m}
            isMe={m.id === me?.id}
            online={m.id === me?.id || online.has(m.id)}
            open={openOf(m.id)}
            load={load.get(m.id) ?? null}
            lists={listsOf(m.id)}
            view={view}
            delay={delay + (i + 1) * 45}
            today={today}
            now={now}
          />
        ))}
        {hasOrphans && (
          <PersonCard
            member={null}
            isMe={false}
            online={false}
            open={0}
            load={null}
            lists={orphans}
            view={view}
            delay={delay + (members.length + 1) * 45}
            today={today}
            now={now}
          />
        )}
      </div>
    </section>
  );
}
