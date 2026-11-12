/**
 * Pure, framework-free derivations used by every screen (dashboard, my tasks,
 * meeting). Keeping them here guarantees all views tell the same story.
 */
import { addDays } from "date-fns";
import { PRIORITY_META } from "./constants";
import { formatShortDate, parseDateOnly, toDateOnly, weekStartDateOnly, weekStartOf } from "./dates";
import { isOpen, isOverdue } from "./task-logic";
import type {
  DateOnly,
  ID,
  Meeting,
  MeetingItem,
  MeetingPriority,
  MeetingSummary,
  Member,
  Project,
  SummaryTask,
  Task,
} from "./types";

/* ------------------------------------------------------------------ */
/* Tri                                                                 */
/* ------------------------------------------------------------------ */

export type SortKey = "manual" | "due" | "priority";

export function compareTasks(sort: SortKey) {
  return (a: Task, b: Task) => {
    if (sort === "due") {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || a.position - b.position;
    }
    if (sort === "priority") {
      const d = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
      if (d !== 0) return d;
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      return a.position - b.position;
    }
    return a.position - b.position;
  };
}

/** Urgency order used by personal lists: overdue → due soon → priority. */
export function compareUrgency(a: Task, b: Task) {
  return compareTasks("due")(a, b);
}

/* ------------------------------------------------------------------ */
/* Meetings                                                            */
/* ------------------------------------------------------------------ */

export function sortMeetingsDesc(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
}

/** Meeting immediately before `meeting` (by week). */
export function previousMeeting(meetings: Meeting[], meeting: Pick<Meeting, "week_start">): Meeting | null {
  return (
    sortMeetingsDesc(meetings).find(
      (m) => m.week_start < meeting.week_start && (m.status === "closed" || m.status === "live"),
    ) ?? null
  );
}

/**
 * Reference instant for "since last Wednesday": start of the previous meeting
 * (or the previous Wednesday at 00:00 when no meeting was held).
 */
export function meetingSince(meetings: Meeting[], weekStart: string): string {
  const prev = previousMeeting(meetings, { week_start: weekStart });
  if (prev?.started_at) return prev.started_at;
  return addDays(parseDateOnly(weekStart), -7).toISOString();
}

/**
 * Weekly priorities belong to a meeting. Two questions, two rules:
 *
 * - EDITING (the ★ on a task): the meeting in progress if there is one,
 *   otherwise the last meeting held, otherwise whatever meeting exists
 *   (a team that has not met yet can still prepare its priorities).
 * - DISPLAYING (dashboard, my tasks): same, except that a meeting that has
 *   just started keeps showing last week's priorities until it defines its
 *   own — the old list stays useful during the review.
 */
export function editablePriorityMeeting(meetings: Meeting[]): Meeting | null {
  const sorted = sortMeetingsDesc(meetings);
  return sorted.find((m) => m.status === "live") ?? sorted.find((m) => m.status === "closed") ?? sorted[0] ?? null;
}

export function displayedPriorityMeeting(meetings: Meeting[], priorities: MeetingPriority[]): Meeting | null {
  const sorted = sortMeetingsDesc(meetings);
  const live = sorted.find((m) => m.status === "live");
  if (live && priorities.some((p) => p.meeting_id === live.id)) return live;
  return sorted.find((m) => m.status === "closed") ?? live ?? sorted[0] ?? null;
}

export function prioritiesFor(meetingId: ID | null | undefined, all: MeetingPriority[]): MeetingPriority[] {
  if (!meetingId) return [];
  return all.filter((p) => p.meeting_id === meetingId).sort((a, b) => a.position - b.position);
}

/**
 * Which meeting the /meeting page is about right now.
 * - A live meeting, whatever its week.
 * - This week's meeting until it is closed — and for the rest of the day it
 *   was closed on, so the team lands on its recap.
 * - From the next day on: next Wednesday's meeting (preparation).
 */
export function targetMeetingWeek(meetings: Meeting[], now: Date): string {
  // A meeting in progress always wins: everyone lands in the same room.
  const live = sortMeetingsDesc(meetings).find((m) => m.status === "live");
  if (live) return live.week_start;
  const current = weekStartDateOnly(now);
  const m = meetings.find((x) => x.week_start === current);
  if (m && m.status === "closed") {
    const closedToday = !!m.ended_at && toDateOnly(new Date(m.ended_at)) === toDateOnly(now);
    if (!closedToday) return toDateOnly(addDays(parseDateOnly(current), 7));
  }
  return current;
}

/** Topics still open: this meeting's + unresolved ones carried from earlier meetings. */
export function topicsFor(meeting: Pick<Meeting, "id" | "week_start">, meetings: Meeting[], items: MeetingItem[]) {
  const weekOf = new Map(meetings.map((m) => [m.id, m.week_start]));
  return items
    .filter(
      (i) =>
        i.kind === "topic" &&
        (i.meeting_id === meeting.id ||
          (!i.done && (weekOf.get(i.meeting_id) ?? "9999") < meeting.week_start)),
    )
    .sort((a, b) => {
      const wa = weekOf.get(a.meeting_id) ?? "";
      const wb = weekOf.get(b.meeting_id) ?? "";
      if (wa !== wb) return wa < wb ? -1 : 1; // carried-over first
      return a.position - b.position;
    });
}

export function decisionsFor(meetingId: ID, items: MeetingItem[]) {
  return items.filter((i) => i.kind === "decision" && i.meeting_id === meetingId).sort((a, b) => a.position - b.position);
}

/* ------------------------------------------------------------------ */
/* Seaux du meeting                                                    */
/* ------------------------------------------------------------------ */

export interface MeetingBuckets {
  completed: Task[];
  stalled: Task[];
  overdue: Task[];
  blocked: Task[];
  review: Task[];
}

export function meetingBuckets(tasks: Task[], since: string, today: string): MeetingBuckets {
  const live = tasks.filter((t) => !t.archived_at || (t.completed_at && t.completed_at >= since));
  return {
    completed: live
      .filter((t) => t.status === "done" && t.completed_at && t.completed_at >= since)
      .sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? 1 : -1)),
    stalled: live
      .filter(
        (t) =>
          isOpen(t) &&
          t.status !== "blocked" &&
          t.status !== "review" &&
          t.created_at < since &&
          t.status_changed_at < since,
      )
      .sort(compareUrgency),
    overdue: live.filter((t) => isOverdue(t, today)).sort(compareUrgency),
    blocked: live.filter((t) => isOpen(t) && t.status === "blocked").sort(compareUrgency),
    review: live.filter((t) => isOpen(t) && t.status === "review").sort(compareUrgency),
  };
}

/* ------------------------------------------------------------------ */
/* Projets & indicateurs                                               */
/* ------------------------------------------------------------------ */

export interface ProjectStats {
  total: number;
  done: number;
  open: number;
  byStatus: Record<Task["status"], number>;
  progress: number;
  overdue: number;
  upcoming: Task[];
}

export function projectStats(tasks: Task[], projectId: ID, today: string): ProjectStats {
  const list = tasks.filter((t) => t.project_id === projectId && !t.archived_at);
  const byStatus = { todo: 0, in_progress: 0, review: 0, blocked: 0, done: 0 };
  for (const t of list) byStatus[t.status]++;
  // Archived tasks are finished work: count them in the progress.
  const archivedDone = tasks.filter((t) => t.project_id === projectId && t.archived_at && t.status === "done").length;
  const total = list.length + archivedDone;
  const done = byStatus.done + archivedDone;
  return {
    total,
    done,
    open: list.length - byStatus.done,
    byStatus,
    progress: total ? Math.round((done / total) * 100) : 0,
    overdue: list.filter((t) => isOverdue(t, today)).length,
    upcoming: list
      .filter((t) => isOpen(t) && t.due_date)
      .sort(compareUrgency)
      .slice(0, 3),
  };
}

export function teamKpis(tasks: Task[], today: string, weekStartIso: string, meId: ID | null) {
  const live = tasks.filter((t) => !t.archived_at);
  const open = live.filter(isOpen);
  const inProgress = open.filter((t) => t.status === "in_progress" || t.status === "review");
  const atRisk = open.filter((t) => t.status === "blocked" || isOverdue(t, today));
  const doneWeek = tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= weekStartIso);
  const mine = (l: Task[]) => (meId ? l.filter((t) => t.assignee_id === meId).length : 0);
  return {
    open: { count: open.length, mine: mine(open) },
    inProgress: { count: inProgress.length, mine: mine(inProgress) },
    atRisk: {
      count: atRisk.length,
      mine: mine(atRisk),
      blocked: atRisk.filter((t) => t.status === "blocked").length,
      overdue: atRisk.filter((t) => isOverdue(t, today)).length,
    },
    doneWeek: { count: doneWeek.length, mine: mine(doneWeek) },
  };
}

/* ------------------------------------------------------------------ */
/* Rythme                                                              */
/* ------------------------------------------------------------------ */

/** What needs unblocking: open tasks that are blocked or past their date. Blocked first, then the oldest dates. */
export function atRiskTasks(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => isOpen(t) && (t.status === "blocked" || isOverdue(t, today)))
    .sort((a, b) => Number(b.status === "blocked") - Number(a.status === "blocked") || compareUrgency(a, b));
}

export interface WeekCount {
  /** Wednesday that opens the week. */
  start: DateOnly;
  /** Tasks finished during that week (Wednesday to Tuesday). */
  done: number;
}

/**
 * Tasks finished per team week, oldest first, ending with the week in
 * progress. Archived tasks count: finished work stays finished.
 */
export function weeklyDone(tasks: Task[], now: Date, weeks = 6): WeekCount[] {
  const current = weekStartOf(now);
  const out: WeekCount[] = [];
  for (let k = weeks - 1; k >= 0; k--) out.push({ start: toDateOnly(addDays(current, -7 * k)), done: 0 });
  // Matched by calendar date, not by elapsed time: a week that crosses a clock change is still a week.
  const byStart = new Map(out.map((w) => [w.start, w]));
  for (const t of tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    const week = byStart.get(weekStartDateOnly(new Date(t.completed_at)));
    if (week) week.done++;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Récapitulatif                                                       */
/* ------------------------------------------------------------------ */

interface SummaryContext {
  tasks: Task[];
  members: Member[];
  projects: Project[];
  items: MeetingItem[];
  priorities: MeetingPriority[];
  meetings: Meeting[];
}

export function toSummaryTask(t: Task, members: Map<ID, Member>, projects: Map<ID, Project>): SummaryTask {
  return {
    id: t.id,
    title: t.title,
    project_id: t.project_id,
    project_name: projects.get(t.project_id)?.name ?? "",
    assignee_id: t.assignee_id,
    assignee_name: t.assignee_id ? (members.get(t.assignee_id)?.full_name ?? null) : null,
    due_date: t.due_date,
    status: t.status,
    priority: t.priority,
  };
}

export function buildMeetingSummary(ctx: SummaryContext, meeting: Meeting, closedAt: string): MeetingSummary {
  const members = new Map(ctx.members.map((m) => [m.id, m]));
  const projects = new Map(ctx.projects.map((p) => [p.id, p]));
  const tasksById = new Map(ctx.tasks.map((t) => [t.id, t]));
  const since = meetingSince(ctx.meetings, meeting.week_start);
  const snap = (t: Task) => toSummaryTask(t, members, projects);

  const completed = ctx.tasks
    .filter((t) => t.status === "done" && t.completed_at && t.completed_at >= since && t.completed_at <= closedAt)
    .sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? -1 : 1));
  const created = ctx.tasks.filter((t) => t.meeting_id === meeting.id);
  const priorities = prioritiesFor(meeting.id, ctx.priorities)
    .map((p) => tasksById.get(p.task_id))
    .filter((t): t is Task => !!t);
  const blocked = ctx.tasks.filter((t) => isOpen(t) && t.status === "blocked");

  const started = meeting.started_at ? new Date(meeting.started_at).getTime() : null;
  return {
    version: 1,
    since,
    closed_at: closedAt,
    duration_minutes: started ? Math.max(1, Math.round((new Date(closedAt).getTime() - started) / 60_000)) : null,
    completed: completed.map(snap),
    created: created.map(snap),
    priorities: priorities.map(snap),
    blocked: blocked.map(snap),
    decisions: decisionsFor(meeting.id, ctx.items).map((i) => ({ id: i.id, body: i.body, project_id: i.project_id })),
    open_topics: topicsFor(meeting, ctx.meetings, ctx.items)
      .filter((i) => !i.done)
      .map((i) => ({ id: i.id, body: i.body, project_id: i.project_id })),
    attendees: meeting.attendees
      .map((id) => members.get(id))
      .filter((m): m is Member => !!m)
      .map((m) => ({ id: m.id, name: m.full_name })),
  };
}

/**
 * Plain-text recap, ready to paste in an email or a chat. Written the way a
 * person would send minutes: what each partner takes on first, then what was
 * decided, created and finished. Empty sections are left out.
 */
export function summaryToText(summary: MeetingSummary, title: string): string {
  const due = (t: SummaryTask) => (t.due_date ? `, pour le ${formatShortDate(parseDateOnly(t.due_date))}` : "");
  const out: string[] = [title];
  const section = (heading: string, lines: string[]) => {
    if (lines.length) out.push("", heading, ...lines);
  };

  // Priorities, grouped by the person who carries them.
  const byOwner = new Map<string, SummaryTask[]>();
  for (const t of summary.priorities) {
    const owner = t.assignee_name ?? "Sans responsable";
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), t]);
  }
  const priorities: string[] = [];
  for (const [owner, tasks] of byOwner) {
    priorities.push(`${owner} :`);
    for (const t of tasks) priorities.push(`  - ${t.title} (${t.project_name}${due(t)})`);
  }
  section(`Priorités de la semaine (${summary.priorities.length})`, priorities);

  section(
    `Décisions (${summary.decisions.length})`,
    summary.decisions.map((d) => `- ${d.body}`),
  );
  section(
    `Nouvelles tâches (${summary.created.length})`,
    summary.created.map((t) => `- ${t.title} — ${t.assignee_name ?? "sans responsable"} (${t.project_name}${due(t)})`),
  );
  section(
    `Accompli depuis le dernier meeting (${summary.completed.length})`,
    summary.completed.map((t) => `- ${t.title} — ${t.assignee_name ?? "sans responsable"} (${t.project_name})`),
  );
  section(
    `Points reportés au prochain meeting (${summary.open_topics.length})`,
    summary.open_topics.map((d) => `- ${d.body}`),
  );
  return out.join("\n");
}
