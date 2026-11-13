"use client";

import { ArrowLeft, CalendarX2 } from "@/components/kit/icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { AvatarStack } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import { capitalize, formatLongDate, parseDateOnly, weekNumber } from "@/lib/dates";
import { useMembersMap } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Member } from "@/lib/types";
import { Recap } from "./recap";

/** Frozen recap of a past meeting (history). */
export function PastMeeting() {
  const { id } = useParams<{ id: string }>();
  const meeting = useApp((s) => s.meetings[id] ?? null);
  const members = useMembersMap();

  if (!meeting || !meeting.summary) {
    return (
      <>
        <PageHeader title="Meeting introuvable" />
        <EmptyState
          className="py-24"
          icon={<CalendarX2 className="size-4" />}
          title="Ce récapitulatif n'existe pas"
          hint="Le meeting n'a peut-être pas encore été clôturé."
          action={
            <Button asChild variant="outline">
              <Link href="/meeting">Retour au meeting</Link>
            </Button>
          }
        />
      </>
    );
  }
  const date = parseDateOnly(meeting.week_start);
  const present = meeting.attendees.map((m) => members[m]).filter((m): m is Member => !!m);
  return (
    <>
      <PageHeader
        icon={
          <Button asChild variant="ghost" size="icon-sm" aria-label="Retour">
            <Link href="/meeting">
              <ArrowLeft />
            </Link>
          </Button>
        }
        title={`Meeting du ${formatLongDate(date).toLowerCase()}`}
        subtitle={`Semaine ${weekNumber(date)}${meeting.summary.duration_minutes ? ` · ${meeting.summary.duration_minutes} min` : ""}`}
        actions={present.length > 0 ? <AvatarStack members={present} size="sm" /> : null}
      />
      <main className="w-full max-w-[1280px] space-y-4 px-4 pt-5 pb-24 sm:px-6 lg:px-8">
        <p className="text-[13px] text-muted-foreground">
          Récapitulatif figé au moment de la clôture — {capitalize(formatLongDate(new Date(meeting.summary.closed_at)))}.
        </p>
        <Recap meeting={meeting} summary={meeting.summary} />
      </main>
    </>
  );
}
