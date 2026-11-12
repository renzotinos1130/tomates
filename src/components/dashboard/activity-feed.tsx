"use client";

import { useMemo } from "react";
import { describeEvent } from "@/lib/activity";
import { relativeTime } from "@/lib/dates";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { firstName } from "@/lib/utils";
import { Section } from "./section";

/** Quiet stream of what changed recently. */
export function ActivityFeed({ className, delay, limit = 9 }: { className?: string; delay?: number; limit?: number }) {
  const now = useNow();
  const events = useApp((s) => s.task_events);
  const tasks = useApp((s) => s.tasks);
  const members = useMembersMap();
  const projects = useProjectsMap();

  const recent = useMemo(
    () =>
      Object.values(events)
        .filter((e) => tasks[e.task_id] && e.kind !== "title")
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit),
    [events, tasks, limit],
  );

  return (
    <Section className={className} delay={delay} title="Activité récente">
      {recent.length === 0 ? (
        <p className="py-2 text-[13px] text-navy-500">Les tâches créées, modifiées ou terminées apparaîtront ici.</p>
      ) : (
        <ul className="-mx-2.5">
          {recent.map((e) => {
            const actor = e.actor_id ? members[e.actor_id] : null;
            const text = describeEvent(e, { members, projects });
            const task = tasks[e.task_id];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => ui.openTask(task.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-navy-900/[0.035] focus-ring"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-navy-500">
                    <span className="text-navy-900">{actor ? firstName(actor.full_name) : "Quelqu'un"}</span> {text.verb}{" "}
                    <span className="text-navy-900">{task.title}</span>
                    {text.detail && <span> {text.detail}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-navy-400 tabular">{relativeTime(e.created_at, now)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
