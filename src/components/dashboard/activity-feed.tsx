"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/kit/empty-state";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { describeEvent } from "@/lib/activity";
import { relativeTime } from "@/lib/dates";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { cn, firstName } from "@/lib/utils";
import { Tile, TileHeader } from "./bento";

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
    <Tile className={className} delay={delay}>
      <TileHeader title="Activité récente" hint="Ce qui a bougé dans les projets" />
      {recent.length === 0 ? (
        <EmptyState title="Rien à signaler" hint="Les tâches créées, modifiées ou terminées apparaîtront ici." />
      ) : (
        <ul className="px-2.5 pb-3">
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
                  <MemberAvatar member={actor} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-navy-500">
                    <span className="font-medium text-navy-800">{actor ? firstName(actor.full_name) : "Quelqu'un"}</span>{" "}
                    <span className={cn(text.tone === "blocked" && "text-coral-600")}>{text.verb}</span>{" "}
                    <span className="font-medium text-navy-800">{task.title}</span>
                    {text.detail && <span> {text.detail}</span>}
                  </span>
                  <span className="hidden shrink-0 text-xs text-navy-400 sm:inline">{projects[task.project_id]?.name}</span>
                  <span className="w-[72px] shrink-0 text-right text-xs text-navy-400 tabular">
                    {relativeTime(e.created_at, now)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}
