"use client";

import { differenceInCalendarDays } from "date-fns";
import { ArrowRight, ArrowUpRight, CalendarCheck2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { TaskLine } from "@/components/tasks/task-line";
import { parseDateOnly, startOfDay, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMe, useMeetings, useNow, useWeekPriorities } from "@/lib/hooks";
import { targetMeetingWeek, topicsFor } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { isOpen, isOverdue } from "@/lib/task-logic";
import type { Task } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Panel, PANEL_LINK } from "./panel";
import { useFitRows } from "./use-fit-rows";

/** The weekly ritual, one click away: when it is, and how much there is to talk about. */
function MeetingRow() {
  const now = useNow();
  const meetings = useMeetings();
  const items = useApp((s) => s.meeting_items);

  const info = useMemo(() => {
    const week = targetMeetingWeek(meetings, now);
    const meeting = meetings.find((m) => m.week_start === week) ?? null;
    const days = differenceInCalendarDays(parseDateOnly(week), startOfDay(now));
    const topics = topicsFor({ id: meeting?.id ?? "", week_start: week }, meetings, Object.values(items)).filter(
      (t) => !t.done,
    );
    return { status: meeting?.status ?? "planned", days, topics: topics.length };
  }, [meetings, now, items]);

  const live = info.status === "live";
  const closed = info.status === "closed";
  const when =
    info.days === 0
      ? "Aujourd'hui"
      : info.days === 1
        ? "Demain"
        : info.days < 0
          ? `Il y a ${plural(-info.days, "jour")}`
          : `Dans ${info.days} jours`;
  const detail = closed ? "Terminé · voir le récapitulatif" : `${when} · ${plural(info.topics, "point à discuter", "points à discuter")}`;
  const action = live ? "Rejoindre le meeting" : closed ? "Voir le récapitulatif" : info.days === 0 ? "Ouvrir le meeting" : "Préparer le meeting";

  return (
    <Link
      href="/meeting"
      aria-label={`Meeting du mercredi. ${live ? "En direct" : detail}. ${action}`}
      className="group/meeting mt-auto flex items-center gap-2.5 rounded-xl pt-4 focus-ring"
    >
      <span className="gw-chip size-9 rounded-[10px] text-navy-800">
        <CalendarCheck2 className="size-[19px]" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <strong className="truncate text-[13px] leading-tight font-medium text-navy-900">Meeting du mercredi</strong>
        {live ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-coral-600">
            <span className="size-1.5 animate-pulse-ring rounded-full bg-coral-500 text-coral-500" />
            En direct
          </span>
        ) : (
          <span className="mt-0.5 truncate text-xs text-navy-600">{detail}</span>
        )}
      </span>
      <span className="gw-chip ml-auto size-9 rounded-full text-navy-800 transition-colors group-hover/meeting:bg-white/70 group-hover/meeting:text-navy-900">
        <ArrowUpRight className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </span>
    </Link>
  );
}

/**
 * What is on my plate: the one figure the page leads with, what it is made of,
 * the tasks to take first (as many as the tile has room for), and the next
 * meeting underneath.
 */
export function MyWeek({ className, delay }: { className?: string; delay?: number }) {
  const now = useNow();
  const me = useMe();
  const tasks = useAllTasks();
  const { ids: priorityIds } = useWeekPriorities();
  const today = todayDateOnly(now);

  const mine = useMemo(() => tasks.filter((t) => isOpen(t) && t.assignee_id === me?.id), [tasks, me?.id]);
  const priorities = mine.filter((t) => priorityIds.has(t.id)).length;
  const late = mine.filter((t) => isOverdue(t, today)).length;
  const blocked = mine.filter((t) => t.status === "blocked").length;
  const rest = [late > 0 && `${late} en retard`, blocked > 0 && plural(blocked, "bloquée")].filter(Boolean);
  const rows = useFitRows<HTMLDivElement>();
  // What to take first: the week's priorities, then what is late, what is under way, and the rest by date.
  const next = useMemo(() => {
    const rank = (t: Task) =>
      priorityIds.has(t.id) ? 0 : isOverdue(t, today) ? 1 : t.status === "in_progress" || t.status === "review" ? 2 : 3;
    const due = (t: Task) => t.due_date ?? "9999-12-31";
    return [...mine].sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b))).slice(0, 8);
  }, [mine, priorityIds, today]);

  return (
    <Panel
      className={`flex flex-col ${className ?? ""}`}
      delay={delay}
      quiet
      title="Vos tâches ouvertes"
      aside={
        <Link href="/mes-taches" className={PANEL_LINK}>
          Mes tâches
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <p className="text-[clamp(38px,3.6vw,48px)] leading-[1.1] font-medium tracking-[-0.04em] text-navy-900">
        {mine.length}
      </p>
      <p className="mt-2.5 text-xs leading-5 text-navy-600">
        {mine.length === 0 ? (
          "Rien ne vous attend pour l'instant."
        ) : (
          <>
            {priorities > 0 && (
              // Tomato marks the week's priorities, here and on their own tile.
              <span className="mr-1.5 rounded-[5px] bg-tomato-500/[0.13] px-[5px] py-[3px] font-medium text-tomato-700">
                {plural(priorities, "priorité")}
              </span>
            )}
            {priorities > 0 ? "de la semaine" : "Aucune priorité de la semaine"}
            {rest.length > 0 && <> · {rest.join(" · ")}</>}
          </>
        )}
      </p>
      {next.length > 0 ? (
        // The tile is as tall as its neighbour: the list takes the room that is left, in whole rows.
        <div ref={rows} className="gw-rows gw-fit mt-3 min-h-[132px] flex-1 basis-0 @3xl/dash:min-h-[88px]">
          {next.map((t) => (
            <TaskLine
              key={t.id}
              task={t}
              show={{ lead: "status", status: false, project: false, assignee: false }}
              className="min-h-11 hover:bg-white/35"
            />
          ))}
        </div>
      ) : (
        // Nothing left to do: the ripe tomato keeps the tile company.
        <div className="flex flex-1 items-center justify-center py-5">
          <PixelTomato size={48} decorative />
        </div>
      )}
      <MeetingRow />
    </Panel>
  );
}
