"use client";

import { useMemo } from "react";
import { MemberAvatar } from "@/components/kit/member-avatar";
import { describeEvent } from "@/lib/activity";
import { relativeTime } from "@/lib/dates";
import { useMembersMap, useNow, useProjectsMap } from "@/lib/hooks";
import { ui, useApp } from "@/lib/store";
import { cn, firstName } from "@/lib/utils";
import { Panel } from "./panel";
import { useFitRows } from "./use-fit-rows";

/**
 * What changed recently: who, what they did, to which task, and when. Laid
 * out after the "Activity" block the team picked as reference (an avatar, one
 * sentence, the time), on glass instead of an opaque card.
 */
export function ActivityFeed({ className, delay, limit = 14 }: { className?: string; delay?: number; limit?: number }) {
  const now = useNow();
  const rows = useFitRows<HTMLUListElement>();
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
    <Panel
      className={cn("flex flex-col", className)}
      delay={delay}
      title="Activité"
      description="Ce qui a bougé récemment dans l'espace."
    >
      {recent.length === 0 ? (
        <p className="py-2 text-[13px] text-navy-600">Les tâches créées, modifiées ou terminées apparaîtront ici.</p>
      ) : (
        // A tall tile at the side of the bento: it shows the events that fit its height.
        // Alone on its row (a phone), it shows four or five.
        <ul ref={rows} className="gw-rows gw-fit -my-2 min-h-[310px] flex-1 basis-0 @3xl/dash:min-h-[190px]">
          {recent.map((e) => {
            const actor = e.actor_id ? members[e.actor_id] : null;
            const text = describeEvent(e, { members, projects });
            const task = tasks[e.task_id];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => ui.openTask(task.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-glaze/35 focus-ring"
                >
                  <MemberAvatar member={actor} size="md" className="size-9 ring-1 ring-glaze/70" />
                  <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug text-navy-600">
                    <span className="font-medium text-navy-900">{actor ? firstName(actor.full_name) : "Quelqu'un"}</span>{" "}
                    {text.verb} <span className="font-medium text-navy-900">{task.title}</span>
                    {text.detail && <span> {text.detail}</span>}
                  </p>
                  <span className="shrink-0 text-xs text-navy-500 tabular">{relativeTime(e.created_at, now)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
