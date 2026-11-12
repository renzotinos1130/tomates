"use client";

import { addDays, differenceInCalendarDays } from "date-fns";
import { ArrowRight, Check, History as HistoryIcon, Play, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/kit/empty-state";
import { AvatarStack, MemberAvatar } from "@/components/kit/member-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  capitalize,
  formatLongDate,
  formatShortDate,
  parseDateOnly,
  startOfDay,
  toDateOnly,
  weekNumber,
} from "@/lib/dates";
import { useLocalState, useMeetings, useMembers, useMembersMap, useNow } from "@/lib/hooks";
import { previousMeeting, targetMeetingWeek } from "@/lib/selectors";
import { closeMeeting, reopenMeeting, setAttendees, startMeeting, ui, useApp } from "@/lib/store";
import type { Meeting, Member } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Agenda } from "./agenda";
import { Buckets, useMeetingBuckets } from "./buckets";
import { LiveMeeting, Stepper, useElapsed, useSteps } from "./live";
import { Recap } from "./recap";

/* ------------------------------------------------------------------ */
/* Hero — before the meeting                                           */
/* ------------------------------------------------------------------ */

/** How the meeting screens open: a line of context, the date in large type. No slab — dark is kept for "en direct". */
const HERO = "gw-reveal pt-1 pb-2";
const HERO_TITLE = "mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] text-navy-900 sm:text-[26px]";

function HeroKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-navy-500">{children}</p>;
}

function PrepHero({ week }: { week: string }) {
  const now = useNow();
  const members = useMembers();
  const presence = useApp((s) => s.presence);
  const [starting, setStarting] = useState(false);

  const date = parseDateOnly(week);
  const days = differenceInCalendarDays(date, startOfDay(now));
  const when = days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : days > 1 ? `Dans ${days} jours` : `Prévu il y a ${-days} j`;
  const meId = useApp((s) => s.meId);
  const inRoom = useMemo(() => {
    const ids = new Set(presence.filter((p) => p.page.startsWith("/meeting")).map((p) => p.member_id));
    return members.filter((m) => ids.has(m.id) && m.id !== meId);
  }, [presence, members, meId]);

  return (
    <section className={HERO}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <HeroKicker>
            {when} · semaine {weekNumber(date)}
          </HeroKicker>
          <h2 className={HERO_TITLE}>{capitalize(formatLongDate(date))}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {inRoom.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-navy-500">
              <AvatarStack members={inRoom} size="sm" />
              {inRoom.length > 1 ? "sont aussi sur cette page" : "est aussi sur cette page"}
            </div>
          )}
          <Button
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await startMeeting(week);
              setStarting(false);
            }}
          >
            <Play className="fill-current" /> Démarrer le meeting
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live bar — during the meeting                                       */
/* ------------------------------------------------------------------ */

function Attendees({ meeting }: { meeting: Meeting }) {
  const members = useMembers();
  const present = members.filter((m) => meeting.attendees.includes(m.id));
  const toggle = (m: Member) => {
    const next = meeting.attendees.includes(m.id) ? meeting.attendees.filter((id) => id !== m.id) : [...meeting.attendees, m.id];
    void setAttendees(meeting.id, next);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Participants"
          className="flex h-8 items-center gap-2 rounded-lg px-1.5 text-xs text-navy-200 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sun-300 focus-visible:outline-none"
        >
          {present.length > 0 ? (
            <AvatarStack members={present} size="sm" className="[&_span]:ring-navy-900" />
          ) : (
            <Users className="size-4" />
          )}
          <span className="hidden sm:inline">
            {present.length}/{members.length}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Participants</DropdownMenuLabel>
        {members.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.id}
            checked={meeting.attendees.includes(m.id)}
            onCheckedChange={() => toggle(m)}
            onSelect={(e) => e.preventDefault()}
            className="gap-2"
          >
            <MemberAvatar member={m} size="xs" /> {m.full_name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LiveBar({
  meeting,
  steps,
  step,
  onStep,
}: {
  meeting: Meeting;
  steps: ReturnType<typeof useSteps>;
  step: string;
  onStep: (key: string) => void;
}) {
  const elapsed = useElapsed(meeting.started_at);
  return (
    <div className="sticky top-[92px] z-10 -mx-4 mt-3 px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="glass-dark relative isolate flex flex-col gap-2.5 overflow-hidden rounded-xl p-2.5 text-white shadow-pop lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 pl-1.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-coral-200">
            <span className="size-2 animate-pulse-ring rounded-full bg-coral-400 text-coral-400" />
            En direct
          </span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs text-navy-100 tabular">{elapsed}</span>
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <Attendees meeting={meeting} />
          </div>
        </div>
        <span className="hidden h-5 w-px bg-white/15 lg:block" />
        <div className="min-w-0 flex-1">
          <Stepper steps={steps} current={step} onChange={onStep} />
        </div>
        <div className="hidden items-center gap-1.5 lg:flex">
          <Attendees meeting={meeting} />
          <Button
            size="sm"
            onClick={() => onStep("close")}
            className="bg-white/10 text-white hover:bg-white/20"
          >
            <Check /> Terminer
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export function History() {
  const meetings = useMeetings();
  const members = useMembersMap();
  const closed = meetings.filter((m) => m.status === "closed");
  if (closed.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState
          className="py-16"
          icon={<HistoryIcon className="size-4" />}
          title="Aucun meeting dans l'historique"
          hint="Chaque rencontre terminée est conservée ici, avec son récapitulatif."
        />
      </div>
    );
  }
  return (
    <ul className="card-surface divide-y divide-navy-900/[0.06] overflow-hidden">
      {closed.map((m, i) => {
        const s = m.summary;
        const date = parseDateOnly(m.week_start);
        const present = m.attendees.map((id) => members[id]).filter((x): x is Member => !!x);
        return (
          <li key={m.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <Link
              href={`/meeting/${m.id}`}
              className="group flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5 transition-colors hover:bg-navy-900/[0.025] focus-visible:bg-navy-900/[0.04] focus-visible:outline-none sm:px-5"
            >
              <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-navy-900/[0.045] py-1.5">
                <span className="text-[11px] font-medium text-navy-500">{formatShortDate(date).split(" ")[1]}</span>
                <span className="text-lg leading-tight font-semibold text-navy-900 tabular">{date.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-navy-900">{capitalize(formatLongDate(date))}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Semaine {weekNumber(date)}
                  {s?.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                </p>
              </div>
              {s && (
                <dl className="flex gap-5 text-center">
                  {[
                    { label: "accomplies", value: s.completed.length },
                    { label: "priorités", value: s.priorities.length },
                    { label: "décisions", value: s.decisions.length },
                  ].map((x) => (
                    <div key={x.label} className="w-16">
                      <dd className="text-[15px] font-semibold text-navy-900 tabular">{x.value}</dd>
                      <dt className="text-[11px] text-muted-foreground">{x.label}</dt>
                    </div>
                  ))}
                </dl>
              )}
              <AvatarStack members={present} size="sm" max={5} className="hidden md:flex" />
              <ArrowRight className="size-4 text-navy-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LastRecapLink({ meeting }: { meeting: Meeting }) {
  const s = meeting.summary;
  return (
    <Link
      href={`/meeting/${meeting.id}`}
      className="card-surface card-interactive group flex items-center gap-3 p-4 focus-ring"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-navy-900">
          Récapitulatif du {formatShortDate(parseDateOnly(meeting.week_start))}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {s ? `${plural(s.priorities.length, "priorité")} · ${plural(s.decisions.length, "décision")}` : "Dernier meeting"}
        </p>
      </div>
      <ArrowRight className="size-4 text-navy-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
    </Link>
  );
}

export function MeetingPage() {
  const now = useNow();
  const meetings = useMeetings();
  const [tab, setTab] = useState<"current" | "history">("current");
  const steps = useSteps();

  const week = targetMeetingWeek(meetings, now);
  const meeting = meetings.find((m) => m.week_start === week) ?? null;
  const [step, setStep] = useLocalState<string>(`tthq:meeting-step:${week}`, "review");
  const buckets = useMeetingBuckets(week);
  const last = previousMeeting(meetings, { week_start: week });
  const date = parseDateOnly(week);
  const status = meeting?.status ?? "planned";
  const live = status === "live";
  const closedCount = meetings.filter((m) => m.status === "closed").length;
  const nextWeek = toDateOnly(addDays(date, 7));

  const tabs = [
    { key: "current" as const, label: live ? "En direct" : status === "closed" ? "Récapitulatif" : "Préparation" },
    { key: "history" as const, label: `Historique${closedCount ? ` · ${closedCount}` : ""}` },
  ];

  return (
    <>
      <PageHeader
        title="Meeting du mercredi"
        subtitle={`${capitalize(formatLongDate(date))} · semaine ${weekNumber(date)}`}
      >
        <div role="tablist" className="-mb-px flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative h-9 rounded-t-lg px-3 text-[13px] font-medium transition-colors focus-ring",
                tab === t.key ? "text-navy-900" : "text-navy-500 hover:text-navy-800",
              )}
            >
              <span className="flex items-center gap-1.5">
                {t.key === "current" && live && (
                  <span className="size-1.5 animate-pulse-ring rounded-full bg-coral-500 text-coral-500" />
                )}
                {t.label}
              </span>
              {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-navy-900" />}
            </button>
          ))}
        </div>
      </PageHeader>

      <main className="w-full max-w-[1520px] px-4 pb-24 sm:px-6 lg:px-8">
        {tab === "history" ? (
          <div className="pt-5">
            <History />
          </div>
        ) : live && meeting ? (
          <>
            <LiveBar meeting={meeting} steps={steps} step={step} onStep={setStep} />
            <div className="pt-3">
              <LiveMeeting meeting={meeting} steps={steps} step={step} onStep={setStep} />
            </div>
          </>
        ) : status === "closed" && meeting ? (
          <div className="space-y-3 pt-5 sm:space-y-4">
            <section className={HERO}>
              <HeroKicker>
                Meeting terminé{meeting.summary?.duration_minutes ? ` · ${meeting.summary.duration_minutes} min` : ""}
              </HeroKicker>
              <h2 className={HERO_TITLE}>{capitalize(formatLongDate(date))}</h2>
            </section>
            {meeting.summary && (
              <Recap
                meeting={meeting}
                summary={meeting.summary}
                showOpenTopics={false}
                actions={
                  <Button
                    variant="ghost"
                    onClick={() =>
                      ui.confirm({
                        title: "Rouvrir ce meeting ?",
                        description: "Le mode réunion reprend là où il s'est arrêté. Le récapitulatif sera recalculé à la clôture.",
                        confirmLabel: "Rouvrir",
                        onConfirm: () => reopenMeeting(meeting.id),
                      })
                    }
                  >
                    <RotateCcw /> Rouvrir
                  </Button>
                }
              />
            )}
            <div className="max-w-xl pt-2">
              <h2 className="px-1 text-[15px] font-semibold text-navy-900">
                Prochain meeting, {formatLongDate(addDays(date, 7)).toLowerCase()}
              </h2>
              <p className="mt-1 mb-3 px-1 text-xs text-muted-foreground">
                Notez dès maintenant les sujets à aborder : ils vous attendront mercredi prochain.
              </p>
              <Agenda weekStart={nextWeek} meetingId={meetings.find((m) => m.week_start === nextWeek)?.id ?? null} showDecisions={false} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-5 sm:space-y-4">
            {meetings.some((m) => m.status === "live") && (
              <div className="card-surface flex items-center gap-3 p-4 text-[13px]">
                <span className="size-2 rounded-full bg-coral-500" />
                Un meeting précédent est resté ouvert.
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={async () => {
                    for (const m of meetings.filter((x) => x.status === "live")) await closeMeeting(m.id);
                    toast.success("Meeting clôturé");
                  }}
                >
                  Le clôturer
                </Button>
              </div>
            )}
            <PrepHero week={week} />
            <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-8">
                <Buckets buckets={buckets} />
              </div>
              <aside className="min-w-0 space-y-3 sm:space-y-4 xl:col-span-4">
                <Agenda weekStart={week} meetingId={meeting?.id ?? null} showDecisions={false} />
                {last && <LastRecapLink meeting={last} />}
              </aside>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
