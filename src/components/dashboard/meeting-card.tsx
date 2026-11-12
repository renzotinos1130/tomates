"use client";

import { addDays, differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";
import { capitalize, formatLongDate, parseDateOnly, startOfDay, todayDateOnly } from "@/lib/dates";
import { useAllTasks, useMeetings, useNow } from "@/lib/hooks";
import { meetingBuckets, meetingSince, targetMeetingWeek, topicsFor } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Deep-navy card: the weekly ritual always one click away. Flat on purpose — no glow. */
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

  return (
    <section
      className={cn(
        "gw-reveal flex min-w-0 flex-col rounded-xl bg-navy-900/[0.92] p-5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_14px_30px_-18px_rgb(7_18_38/0.6)]",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-navy-200">
        {live ? (
          <>
            <span className="size-1.5 animate-pulse-ring rounded-full bg-coral-400 text-coral-400" />
            <span className="text-coral-200">En direct</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="size-1.5 rounded-[1px] bg-sun-400" />
            Meeting du mercredi
          </>
        )}
      </div>
      <h2 className="mt-3 text-[22px] leading-tight font-semibold tracking-tight">
        {live ? "Le meeting est en cours" : closed ? "Meeting terminé" : when}
      </h2>
      <p className="mt-1 text-[13px] text-navy-200">
        {capitalize(formatLongDate(closed && info.days < 0 ? addDays(info.date, 0) : info.date))}
      </p>

      <dl className="mt-5 flex divide-x divide-white/10 border-y border-white/10 py-3">
        {[
          { label: "à discuter", value: info.topics.length },
          { label: "à valider", value: info.buckets.review.length },
          { label: info.buckets.blocked.length >= 2 ? "blocages" : "blocage", value: info.buckets.blocked.length },
        ].map((s) => (
          <div key={s.label} className="flex-1 px-3 first:pl-0 last:pr-0">
            <dd className="text-xl leading-none font-semibold tabular">{s.value}</dd>
            <dt className="mt-1.5 truncate text-xs text-navy-200">{s.label}</dt>
          </div>
        ))}
      </dl>

      {info.topics.length > 0 && !closed && (
        <div className="mt-4">
          <div className="text-xs font-medium text-navy-300">Points à discuter</div>
          <ul className="mt-2 space-y-1.5">
            {info.topics.slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-[13px] leading-snug text-navy-100">
                <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 bg-sun-400" />
                <span className="line-clamp-2">{t.body}</span>
              </li>
            ))}
            {info.topics.length > 4 && (
              <li className="pl-3 text-xs text-navy-300">
                + {info.topics.length - 4} {info.topics.length - 4 === 1 ? "autre" : "autres"}
              </li>
            )}
          </ul>
        </div>
      )}

      <Link
        href="/meeting"
        className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-white px-3 text-[13px] font-semibold text-navy-950 transition-colors hover:bg-navy-50 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
      >
        {live ? "Rejoindre le meeting" : closed ? "Voir le récapitulatif" : info.days === 0 ? "Ouvrir le meeting" : "Préparer le meeting"}
      </Link>
    </section>
  );
}
