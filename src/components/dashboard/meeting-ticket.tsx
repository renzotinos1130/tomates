"use client";

import { differenceInCalendarDays, format } from "date-fns";
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
import { useFitRows } from "./use-fit-rows";

/** The clock of a meeting in progress. On its own, so that only it is redrawn every second. */
function Elapsed({ since }: { since: string | null }) {
  return <span className="ticket-when meeting-clock tabular">{useElapsed(since)}</span>;
}

/**
 * The weekly ritual, as a ticket: its date on a tomato stub (the one block of
 * plain colour on the page), then how far it is, what there is to talk about,
 * and the way in. While a meeting is running the ticket turns dark (dark
 * means « en direct », here as on the meeting page) and shows its clock.
 */
export function MeetingTicket({ className, delay = 0 }: { className?: string; delay?: number }) {
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
  const recap = closed ? (meeting?.summary ?? null) : null;
  const attendees = live ? (meeting?.attendees ?? []).map((id) => members[id]).filter((m): m is Member => !!m) : [];
  const action = live ? "Rejoindre le meeting" : closed ? "Voir le récapitulatif" : days <= 0 ? "Ouvrir le meeting" : "Préparer le meeting";
  const quiet = live ? "text-white/75" : "text-navy-600";
  const when = closed
    ? "Terminé"
    : days >= 2
      ? `Dans ${days} jours`
      : days === 1
        ? "Demain"
        : days === 0
          ? "Aujourd'hui"
          : "En attente";
  const detail = live
    ? meeting?.started_at
      ? `Commencé à ${format(new Date(meeting.started_at), "H 'h' mm", { locale })}`
      : "En cours"
    : closed
      ? [
          capitalize(formatLongDate(date)),
          recap && recap.priorities.length > 0 && plural(recap.priorities.length, "priorité"),
          recap && recap.decisions.length > 0 && plural(recap.decisions.length, "décision"),
        ]
          .filter(Boolean)
          .join(" · ")
      : days < 0
        ? `Prévu ${formatLongDate(date).toLowerCase()}, pas encore tenu`
        : capitalize(formatLongDate(date));

  return (
    <section
      className={cn("gw-panel gw-reveal ticket @container/panel", live && "gw-panel-live", className)}
      style={{ animationDelay: `${delay}ms` }}
      aria-labelledby="dash-meeting"
    >
      {/* The date, as on the stub of a ticket. Said in full in the text beside it. */}
      <div className="ticket-stub" aria-hidden="true">
        <span>{format(date, "EEE", { locale }).replace(".", "")}</span>
        <strong>{format(date, "d")}</strong>
        <span>{format(date, "MMM", { locale }).replace(".", "")}</span>
      </div>
      <div className="ticket-body">
        <header className="mb-2 flex items-center justify-between gap-3">
          <h2 id="dash-meeting" className={cn("truncate text-xs", quiet)}>
            Meeting du mercredi
          </h2>
          {live && (
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-coral-200">
              <span className="size-2 animate-pulse-ring rounded-full bg-coral-400 text-coral-400" />
              En direct
            </span>
          )}
        </header>
        <p>{live ? <Elapsed since={meeting?.started_at ?? null} /> : <span className="ticket-when">{when}</span>}</p>
        <p className={cn("mt-1.5 text-xs leading-5", quiet)}>{detail}</p>
        {attendees.length > 0 && <AvatarStack members={attendees} size="sm" max={6} className="mt-2.5" />}

        <h3 className={cn("mt-3.5 mb-0.5 text-xs", quiet)}>
          {topics.length === 0
            ? closed
              ? "Aucun point reporté"
              : "Rien à discuter pour l'instant"
            : `${closed ? "Reporté au prochain meeting" : "À discuter"} · ${topics.length}`}
        </h3>
        {topics.length > 0 ? (
          <ul ref={rows} className="ticket-topics gw-fit min-h-[64px] flex-1 basis-0 [--fit-row:40px]">
            {topics.map((t) => (
              <li key={t.id}>
                <p className={cn("truncate py-1.5 text-[13px] leading-snug", live ? "text-white/90" : "text-navy-900")}>{t.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("flex-1 text-[13px] leading-5", quiet)}>
            {closed ? "Tout a été discuté." : "Les points s'ajoutent depuis la page du meeting."}
          </p>
        )}

        <Button asChild size="lg" variant={live || (!closed && days <= 0) ? "default" : "outline"} className="mt-3 self-start">
          <Link href="/meeting">
            {action}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
