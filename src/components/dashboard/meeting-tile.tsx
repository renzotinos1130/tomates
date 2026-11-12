"use client";

import { differenceInCalendarDays, addDays, format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AvatarStack } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import { capitalize, formatLongDate, locale, parseDateOnly, startOfDay } from "@/lib/dates";
import { useElapsed, useMeetings, useMembersMap, useNow } from "@/lib/hooks";
import { targetMeetingWeek, topicsFor } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import type { Member } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Figure } from "./figure";
import { useFitRows } from "./use-fit-rows";

/** The clock of a meeting in progress. On its own, so that only it is redrawn every second. */
function Elapsed({ since }: { since: string | null }) {
  return <span className="gw-figure meeting-clock">{useElapsed(since)}</span>;
}

/**
 * Where the week stands between two meetings: the seven days that lead to
 * the next one, Wednesday to Tuesday, then the meeting itself.
 */
function WeekRuler({ meetingDay, daysLeft }: { meetingDay: Date; daysLeft: number }) {
  const today = 7 - daysLeft;
  return (
    <div
      className="meeting-ruler"
      role="img"
      aria-label={daysLeft === 0 ? "Le meeting est aujourd'hui" : `Jour ${today + 1} sur 7 avant le meeting`}
    >
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(meetingDay, i - 7);
        return (
          <span key={i} data-state={i < today ? "past" : i === today ? "today" : "ahead"}>
            <i />
            <span>{format(day, "EEEEE", { locale }).toUpperCase()}</span>
          </span>
        );
      })}
      <span data-state={daysLeft === 0 ? "today" : "meeting"}>
        <i />
        <span>{format(meetingDay, "EEEEE", { locale }).toUpperCase()}</span>
      </span>
    </div>
  );
}

/**
 * The weekly ritual, as a tile of its own: how far it is, what there is to
 * talk about, and the way in. While a meeting is running the tile turns dark
 * (dark means « en direct », here as on the meeting page) and shows its clock.
 */
export function MeetingTile({ className, delay = 0 }: { className?: string; delay?: number }) {
  const now = useNow();
  const meetings = useMeetings();
  const items = useApp((s) => s.meeting_items);
  const members = useMembersMap();
  const rows = useFitRows<HTMLUListElement>();

  const info = useMemo(() => {
    const week = targetMeetingWeek(meetings, now);
    const meeting = meetings.find((m) => m.week_start === week) ?? null;
    const date = parseDateOnly(week);
    const topics = topicsFor({ id: meeting?.id ?? "", week_start: week }, meetings, Object.values(items)).filter((t) => !t.done);
    return { meeting, date, days: differenceInCalendarDays(date, startOfDay(now)), topics };
  }, [meetings, now, items]);

  const { meeting, date, days, topics } = info;
  const status = meeting?.status ?? "planned";
  const live = status === "live";
  const closed = status === "closed";
  const longDate = capitalize(formatLongDate(date));
  const attendees = live ? (meeting?.attendees ?? []).map((id) => members[id]).filter((m): m is Member => !!m) : [];
  const action = live ? "Rejoindre le meeting" : closed ? "Voir le récapitulatif" : days <= 0 ? "Ouvrir le meeting" : "Préparer le meeting";
  const quiet = live ? "text-white/70" : "text-navy-600";
  const recap = closed ? (meeting?.summary ?? null) : null;

  return (
    <section
      className={cn("gw-panel gw-reveal @container/panel flex flex-col", live && "gw-panel-live", className)}
      style={{ animationDelay: `${delay}ms` }}
      aria-labelledby="dash-meeting"
    >
      <header className="gw-panel-title">
        <h2 id="dash-meeting" className="gw-panel-label truncate">
          Meeting du mercredi
        </h2>
        {live && (
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-coral-200">
            <span className="size-2 animate-pulse-ring rounded-full bg-coral-400 text-coral-400" />
            En direct
          </span>
        )}
      </header>

      {live ? (
        <>
          <p>
            <Elapsed since={meeting?.started_at ?? null} />
          </p>
          <p className={cn("mt-3 text-xs leading-5", quiet)}>
            {meeting?.started_at ? `Commencé à ${format(new Date(meeting.started_at), "H 'h' mm", { locale })}` : "En cours"}
          </p>
          {attendees.length > 0 && <AvatarStack members={attendees} size="sm" max={6} className="mt-3" />}
        </>
      ) : closed ? (
        <>
          <p className="meeting-word">Terminé</p>
          <p className={cn("mt-3 text-xs leading-5", quiet)}>
            {[
              longDate,
              recap && recap.priorities.length > 0 && plural(recap.priorities.length, "priorité"),
              recap && recap.decisions.length > 0 && plural(recap.decisions.length, "décision"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </>
      ) : days >= 2 ? (
        <>
          <p className="flex items-baseline gap-2">
            <Figure value={days} />
            <span className="text-[15px] font-medium text-navy-700">jours</span>
          </p>
          <p className={cn("mt-3 text-xs leading-5", quiet)}>{longDate}</p>
        </>
      ) : (
        <>
          <p className="meeting-word">{days === 1 ? "Demain" : days === 0 ? "Aujourd'hui" : "En attente"}</p>
          <p className={cn("mt-3 text-xs leading-5", quiet)}>
            {days < 0 ? `Prévu ${longDate.toLowerCase()}, pas encore tenu` : longDate}
          </p>
        </>
      )}

      {!live && !closed && days >= 0 && days <= 7 && <WeekRuler meetingDay={date} daysLeft={days} />}

      <h3 className={cn("mt-5 mb-1 text-xs", quiet)}>
        {topics.length === 0
          ? closed
            ? "Aucun point reporté"
            : "Rien à discuter pour l'instant"
          : `${closed ? "Reporté au prochain meeting" : "À discuter"} · ${topics.length}`}
      </h3>
      {topics.length > 0 ? (
        <ul ref={rows} className="meeting-topics gw-fit min-h-[76px] flex-1 basis-0 [--fit-row:60px]">
          {topics.map((t) => (
            <li key={t.id}>
              <p className={cn("line-clamp-2 py-2 text-[13px] leading-snug", live ? "text-white/90" : "text-navy-900")}>{t.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("flex-1 text-[13px] leading-5", quiet)}>
          {closed ? "Tout a été discuté." : "Les points s'ajoutent depuis la page du meeting, à tout moment de la semaine."}
        </p>
      )}

      <Button
        asChild
        size="lg"
        variant={live || (!closed && days <= 0) ? "default" : "outline"}
        className="mt-4 self-start"
      >
        <Link href="/meeting">
          {action}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
