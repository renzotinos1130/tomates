"use client";

import { addDays, differenceInCalendarDays } from "date-fns";
import { ArrowRight, CalendarCheck2, Check, History as HistoryIcon, Play, RotateCcw, Users } from "lucide-react";
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
import { previousMeeting, targetMeetingWeek, topicsFor } from "@/lib/selectors";
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

function Glow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(640px 280px at 100% 0%, rgb(18 148 140 / 0.4), transparent 65%), radial-gradient(420px 240px at 0% 120%, rgb(244 179 49 / 0.16), transparent 70%)",
      }}
    />
  );
}

function PrepHero({ week, meeting }: { week: string; meeting: Meeting | null }) {
  const now = useNow();
  const meetings = useMeetings();
  const members = useMembers();
  const presence = useApp((s) => s.presence);
  const items = useApp((s) => s.meeting_items);
  const buckets = useMeetingBuckets(week);
  const [starting, setStarting] = useState(false);

  const date = parseDateOnly(week);
  const days = differenceInCalendarDays(date, startOfDay(now));
  const when = days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : days > 1 ? `Dans ${days} jours` : `Prévu il y a ${-days} j`;
  const topics = useMemo(
    () => topicsFor({ id: meeting?.id ?? "", week_start: week }, meetings, Object.values(items)).filter((t) => !t.done).length,
    [meeting?.id, week, meetings, items],
  );
  const meId = useApp((s) => s.meId);
  const inRoom = useMemo(() => {
    const ids = new Set(presence.filter((p) => p.page.startsWith("/meeting")).map((p) => p.member_id));
    return members.filter((m) => ids.has(m.id) && m.id !== meId);
  }, [presence, members, meId]);

  const stats = [
    { label: "accomplies", value: buckets.completed.length },
    { label: "à valider", value: buckets.review.length },
    { label: "bloquées", value: buckets.blocked.length },
    { label: "en retard", value: buckets.overdue.length },
    { label: "sans progrès", value: buckets.stalled.length },
    { label: "à discuter", value: topics },
  ];

  return (
    <section className="gw-reveal relative isolate overflow-hidden rounded-2xl bg-navy-900/[0.9] p-5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_14px_30px_-18px_rgb(7_18_38/0.6)] sm:p-7">
      <Glow />
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium tracking-wide text-teal-200 uppercase">
            Semaine {weekNumber(date)} · {when}
          </p>
          <h2 className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[34px]">
            {capitalize(formatLongDate(date))}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy-200">
            Tout est prêt pour la rencontre : voici ce qui a bougé depuis mercredi dernier, et ce qui mérite qu&apos;on en
            parle.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Button
            size="lg"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await startMeeting(week);
              setStarting(false);
            }}
            className="h-11 gap-2 rounded-xl bg-sun-400 px-5 text-[14px] font-semibold text-navy-950 shadow-none hover:bg-sun-300"
          >
            <Play className="size-4 fill-current" /> Démarrer le meeting
          </Button>
          {inRoom.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-navy-200">
              <AvatarStack members={inRoom} size="sm" className="[&_span]:ring-navy-900" />
              {inRoom.length > 1 ? "sont aussi sur cette page" : "est aussi sur cette page"}
            </div>
          )}
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/[0.06] ring-inset">
            <dd className="text-xl leading-none font-semibold">{s.value}</dd>
            <dt className="mt-1.5 truncate text-[11px] text-navy-200">{s.label}</dt>
          </div>
        ))}
      </dl>
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
      <div className="glass-dark relative isolate flex flex-col gap-2.5 overflow-hidden rounded-2xl p-2.5 text-white shadow-pop lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 pl-1.5">
          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-coral-200">
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
              <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-paper-100 py-1.5 ring-1 ring-navy-900/[0.05] ring-inset">
                <span className="text-[10px] font-medium tracking-wide text-navy-400 uppercase">
                  {formatShortDate(date).split(" ")[1]}
                </span>
                <span className="text-lg leading-tight font-semibold text-navy-900 tabular">{date.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-navy-900">{capitalize(formatLongDate(date))}</p>
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
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100 ring-inset">
        <CalendarCheck2 className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-navy-900">
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

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6 lg:px-8">
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
            <section className="gw-reveal relative isolate overflow-hidden rounded-2xl bg-navy-900/[0.9] p-5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_14px_30px_-18px_rgb(7_18_38/0.6)] sm:p-7">
              <Glow />
              <p className="text-[11.5px] font-medium tracking-wide text-teal-200 uppercase">
                Meeting terminé{meeting.summary?.duration_minutes ? ` · ${meeting.summary.duration_minutes} min` : ""}
              </p>
              <h2 className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[34px]">
                {capitalize(formatLongDate(date))}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-navy-200">
                Chacun sait ce qu&apos;il doit accomplir avant mercredi prochain. Les priorités sont affichées sur le
                dashboard et dans « Mes tâches ».
              </p>
            </section>
            {meeting.summary && (
              <Recap
                meeting={meeting}
                summary={meeting.summary}
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
            <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-2">
              <div className="card-surface p-4">
                <p className="text-[11px] font-medium tracking-wide text-navy-400 uppercase">Prochain meeting</p>
                <p className="mt-1 text-[15px] font-semibold text-navy-900">{capitalize(formatLongDate(addDays(date, 7)))}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Notez dès maintenant les sujets à aborder : ils vous attendront mercredi prochain.
                </p>
              </div>
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
            <PrepHero week={week} meeting={meeting} />
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
