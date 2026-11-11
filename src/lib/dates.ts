import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  getISOWeek,
  isSameDay,
  isYesterday,
} from "date-fns";
import { frCA } from "date-fns/locale";
import type { DateOnly, Timestamp } from "./types";

/**
 * La semaine de l'équipe commence le MERCREDI (jour du meeting)
 * et se termine le mardi suivant.
 */
export const WEEK_START_DAY = 3; // 0 = dimanche … 3 = mercredi

export const locale = frCA;

/* ---------------------------- primitives ---------------------------- */

export function toDateOnly(d: Date): DateOnly {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(s: DateOnly): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayDateOnly(now = new Date()): DateOnly {
  return toDateOnly(now);
}

/* ------------------------------ semaine ----------------------------- */

/** Mercredi (00:00, heure locale) qui ouvre la semaine contenant `d`. */
export function weekStartOf(d: Date): Date {
  const day = startOfDay(d);
  const diff = (day.getDay() - WEEK_START_DAY + 7) % 7;
  return addDays(day, -diff);
}

export function weekStartDateOnly(d: Date): DateOnly {
  return toDateOnly(weekStartOf(d));
}

/** Mardi qui termine la semaine. */
export function weekEndOf(d: Date): Date {
  return addDays(weekStartOf(d), 6);
}

export function nextWeekStart(d: Date): Date {
  return addDays(weekStartOf(d), 7);
}

export function isMeetingDay(d: Date): boolean {
  return d.getDay() === WEEK_START_DAY;
}

export function weekNumber(d: Date): number {
  return getISOWeek(weekStartOf(d));
}

/** « mer. 11 → mar. 17 nov. » */
export function formatWeekRange(d: Date): string {
  const start = weekStartOf(d);
  const end = weekEndOf(d);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = format(start, sameMonth ? "EEE d" : "EEE d MMM", { locale });
  const right = format(end, "EEE d MMM", { locale });
  return `${left} → ${right}`;
}

/* ----------------------------- formatage ---------------------------- */

export function formatLongDate(d: Date): string {
  const s = format(d, "EEEE d MMMM", { locale });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(d: Date): string {
  return format(d, "d MMM", { locale }).replace(".", "");
}

export function formatDayDate(d: Date): string {
  return format(d, "EEE d MMM", { locale });
}

export function daysUntil(date: DateOnly, now = new Date()): number {
  return differenceInCalendarDays(parseDateOnly(date), startOfDay(now));
}

export interface DueInfo {
  label: string;
  tone: "overdue" | "today" | "soon" | "later" | "done";
  days: number;
}

/** Libellé humain d'une échéance, avec un ton pour la coloration. */
export function describeDue(date: DateOnly, done: boolean, now = new Date()): DueInfo {
  const days = daysUntil(date, now);
  const d = parseDateOnly(date);
  let label: string;
  if (days === 0) label = "Aujourd'hui";
  else if (days === 1) label = "Demain";
  else if (days === -1) label = "Hier";
  else if (days > 1 && days < 7) label = capitalize(format(d, "EEEE", { locale }));
  else label = formatShortDate(d);

  if (done) return { label, tone: "done", days };
  if (days < 0) return { label, tone: "overdue", days };
  if (days === 0) return { label, tone: "today", days };
  if (days <= 3) return { label, tone: "soon", days };
  return { label, tone: "later", days };
}

export function relativeTime(ts: Timestamp, now = new Date()): string {
  const d = new Date(ts);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 45_000) return "à l'instant";
  if (diffMs < 60 * 60_000) return `il y a ${Math.max(1, Math.round(diffMs / 60_000))} min`;
  if (isSameDay(d, now)) return `il y a ${Math.round(diffMs / 3_600_000)} h`;
  if (isYesterday(d)) return `hier, ${format(d, "HH 'h' mm", { locale })}`;
  if (diffMs < 6 * 86_400_000) return format(d, "EEEE", { locale });
  return format(d, "d MMM", { locale });
}

export function relativeFromNow(ts: Timestamp): string {
  return formatDistanceToNowStrict(new Date(ts), { locale, addSuffix: true });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Raccourcis proposés dans le sélecteur d'échéance. */
export function dueShortcuts(now = new Date()) {
  const today = startOfDay(now);
  const endOfWeek = weekEndOf(now);
  const nextMeeting = nextWeekStart(now);
  const shortcuts: { label: string; hint: string; date: DateOnly }[] = [
    { label: "Aujourd'hui", hint: format(today, "EEE", { locale }), date: toDateOnly(today) },
    {
      label: "Demain",
      hint: format(addDays(today, 1), "EEE", { locale }),
      date: toDateOnly(addDays(today, 1)),
    },
  ];
  if (differenceInCalendarDays(endOfWeek, today) > 1) {
    shortcuts.push({
      label: "Fin de semaine",
      hint: format(endOfWeek, "EEE d", { locale }),
      date: toDateOnly(endOfWeek),
    });
  }
  shortcuts.push({
    label: "Prochain meeting",
    hint: format(nextMeeting, "EEE d", { locale }),
    date: toDateOnly(nextMeeting),
  });
  shortcuts.push({
    label: "Dans 2 semaines",
    hint: format(addDays(nextMeeting, 7), "EEE d", { locale }),
    date: toDateOnly(addDays(nextMeeting, 7)),
  });
  return shortcuts;
}
