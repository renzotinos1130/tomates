"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { weekStartDateOnly, weekStartOf, todayDateOnly } from "./dates";
import { displayedPriorityMeeting, editablePriorityMeeting, prioritiesFor, sortMeetingsDesc } from "./selectors";
import { useApp } from "./store";
import type { ID, Meeting, Member, Project, Task } from "./types";

/* ------------------------------- time -------------------------------- */

let nowSnapshot = new Date();
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;

function subscribeNow(cb: () => void) {
  nowListeners.add(cb);
  if (!nowTimer) {
    nowTimer = setInterval(() => {
      nowSnapshot = new Date();
      nowListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    nowListeners.delete(cb);
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

/** Current time, refreshed every 30 s (relative dates, "today", week roll-over). */
export function useNow(): Date {
  return useSyncExternalStore(
    subscribeNow,
    () => nowSnapshot,
    () => nowSnapshot,
  );
}

export function useToday(): string {
  return todayDateOnly(useNow());
}

export function useWeek() {
  const now = useNow();
  const startKey = weekStartDateOnly(now);
  return useMemo(() => {
    const start = weekStartOf(now);
    return { start, startKey, startIso: start.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);
}

/* ------------------------------ entities ----------------------------- */

export function useMe(): Member | null {
  return useApp((s) => (s.meId ? (s.members[s.meId] ?? null) : null));
}

export function useMembersMap(): Record<ID, Member> {
  return useApp((s) => s.members);
}

/** Active members, in a stable order (me first is NOT applied here). */
export function useMembers(): Member[] {
  const members = useApp((s) => s.members);
  return useMemo(
    () =>
      Object.values(members)
        .filter((m) => m.active)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "fr")),
    [members],
  );
}

export function useProjects(): Project[] {
  const projects = useApp((s) => s.projects);
  return useMemo(
    () =>
      Object.values(projects)
        .filter((p) => !p.archived_at)
        .sort((a, b) => a.position - b.position),
    [projects],
  );
}

export function useProjectsMap(): Record<ID, Project> {
  return useApp((s) => s.projects);
}

export function useAllTasks(): Task[] {
  const tasks = useApp((s) => s.tasks);
  const projects = useApp((s) => s.projects);
  // Tasks of archived projects disappear from every aggregate view.
  return useMemo(
    () => Object.values(tasks).filter((t) => !projects[t.project_id]?.archived_at),
    [tasks, projects],
  );
}

export function useTask(id: ID | null): Task | null {
  return useApp((s) => (id ? (s.tasks[id] ?? null) : null));
}

export function useMeetings(): Meeting[] {
  const meetings = useApp((s) => s.meetings);
  return useMemo(() => sortMeetingsDesc(Object.values(meetings)), [meetings]);
}

/* ------------------------- weekly priorities ------------------------- */

/**
 * Priorities to DISPLAY (dashboard, my tasks): those of the last meeting held,
 * or of the live meeting as soon as it starts defining its own.
 */
export function useWeekPriorities(): { meeting: Meeting | null; ids: Set<ID>; ordered: ID[] } {
  const meetings = useApp((s) => s.meetings);
  const priorities = useApp((s) => s.meeting_priorities);
  return useMemo(() => {
    const all = Object.values(priorities);
    const meeting = displayedPriorityMeeting(Object.values(meetings), all);
    const ordered = prioritiesFor(meeting?.id, all).map((p) => p.task_id);
    return { meeting, ids: new Set(ordered), ordered };
  }, [meetings, priorities]);
}

/**
 * Priorities being EDITED (the star on a task): live meeting if one is
 * running, otherwise the last meeting held.
 */
export function useEditablePriorityIds(): Set<ID> {
  const meetings = useApp((s) => s.meetings);
  const priorities = useApp((s) => s.meeting_priorities);
  return useMemo(() => {
    const target = editablePriorityMeeting(Object.values(meetings));
    if (!target) return new Set<ID>();
    return new Set(prioritiesFor(target.id, Object.values(priorities)).map((p) => p.task_id));
  }, [meetings, priorities]);
}

/* ------------------------------- misc -------------------------------- */

export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean } = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (opts.meta) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) handler(e);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === key) handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, opts.meta]);
}

const storageListeners = new Set<() => void>();
/**
 * Values set in this tab. They are the source of truth for the session, so
 * preferences keep working when localStorage is unavailable (private mode,
 * embedded frames); localStorage only adds persistence across visits.
 */
const sessionValues = new Map<string, string>();

function subscribeStorage(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    // Another tab changed it: forget our copy and read the shared value again.
    if (e.key) sessionValues.delete(e.key);
    cb();
  };
  storageListeners.add(cb);
  window.addEventListener("storage", onStorage);
  return () => {
    storageListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function readStorage(key: string): string | null {
  const local = sessionValues.get(key);
  if (local !== undefined) return local;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Small UI preference persisted in localStorage (view mode, sort…).
 * Hydration-safe: the server and the first client render use `initial`.
 */
export function useLocalState<T extends string | number | boolean>(key: string, initial: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(key),
    () => null,
  );
  let value = initial;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }
  const update = useCallback(
    (v: T) => {
      const serialized = JSON.stringify(v);
      sessionValues.set(key, serialized);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        /* private mode: the preference lasts for this visit only */
      }
      storageListeners.forEach((l) => l());
    },
    [key],
  );
  return [value, update];
}

/* ---------------------------- one-second tick ------------------------ */

let tickSnapshot = Date.now();
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(cb: () => void) {
  tickListeners.add(cb);
  if (!tickTimer) {
    tickSnapshot = Date.now();
    tickTimer = setInterval(() => {
      tickSnapshot = Date.now();
      tickListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

/** Timestamp refreshed every second while mounted (meeting timer). */
export function useSecondTick(): number {
  return useSyncExternalStore(
    subscribeTick,
    () => tickSnapshot,
    () => tickSnapshot,
  );
}
