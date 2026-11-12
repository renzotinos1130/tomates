"use client";

import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";
import { capitalize, formatLongDate, parseDateOnly, startOfDay, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMeetings, useNow } from "@/lib/hooks";
import { meetingBuckets, meetingSince, targetMeetingWeek, topicsFor } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { plural } from "@/lib/utils";
import { Section } from "./section";

/** The weekly ritual, always one click away. */
export function MeetingCard({ className, delay = 0 }: { className?: string; delay?: number }) {
  const now = useNow();
  const meetings = useMeetings();
  const items = useApp((s) => s.meeting_items);
  const tasks = useAllTasks();

  const info = useMemo(() => {
    const week = targetMeetingWeek(meetings, now);
    const meeting = meetings.find((m) => m.week_start === week) ?? null;
    const date = parseDateOnly(week);
    const days = differenceInCalendarDays(date, startOfDay(now));
    const buckets = meetingBuckets(tasks, meetingSince(meetings, week), todayDateOnly(now));
    const topics = topicsFor({ id: meeting?.id ?? "", week_start: week }, meetings, Object.values(items)).filter(
      (t) => !t.done,
    );
    return { meeting, date, days, buckets, topics };
  }, [meetings, now, tasks, items]);

  const status = info.meeting?.status ?? "planned";
  const live = status === "live";
  const closed = status === "closed";
  const when =
    info.days === 0
      ? "Aujourd'hui"
      : info.days === 1
        ? "Demain"
        : info.days < 0
          ? `Il y a ${-info.days} j`
          : `Dans ${info.days} jours`;

  const facts = [
    plural(info.topics.length, "point à discuter", "points à discuter"),
    `${info.buckets.review.length} à valider`,
    plural(info.buckets.blocked.length, "blocage"),
  ];

  return (
    <Section
      className={className}
      delay={delay}
      title="Meeting du mercredi"
      aside={
        live ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-coral-600">
            <span className="size-1.5 animate-pulse-ring rounded-full bg-coral-500 text-coral-500" />
            En direct
          </span>
        ) : closed ? (
          "Terminé"
        ) : (
          when
        )
      }
    >
      <p className="text-[15px] font-medium text-navy-900">{capitalize(formatLongDate(info.date))}</p>
      <p className="mt-1 text-[13px] text-navy-500">{facts.join(" · ")}</p>
      <Link
        href="/meeting"
        className="mt-3.5 inline-flex h-8 items-center rounded-lg bg-navy-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-navy-800 focus-ring"
      >
        {live ? "Rejoindre le meeting" : closed ? "Voir le récapitulatif" : info.days === 0 ? "Ouvrir le meeting" : "Préparer le meeting"}
      </Link>
    </Section>
  );
}
