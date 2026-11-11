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
        <ul className="grid gap-x-4 px-2.5 pb-3 md:grid-cols-2">
          {recent.map((e) => {
            const actor = e.actor_id ? members[e.actor_id] : null;
            const text = describeEvent(e, { members, projects });
            const task = tasks[e.task_id];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => ui.openTask(task.id)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-navy-900/[0.035] focus-ring"
                >
                  <MemberAvatar member={actor} size="sm" className="mt-0.5" />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-navy-500">
                    <span className="font-medium text-navy-800">{actor ? firstName(actor.full_name) : "Quelqu'un"}</span>{" "}
                    <span className={cn(text.tone === "done" && "text-leaf-600", text.tone === "blocked" && "text-coral-600")}>
                      {text.verb}
                    </span>{" "}
                    <span className="font-medium text-navy-800">{task.title}</span>
                    {text.detail && <span> {text.detail}</span>}
                    <span className="block pt-0.5 text-[11px] text-navy-400">
                      {projects[task.project_id]?.name} · {relativeTime(e.created_at, now)}
                    </span>
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
