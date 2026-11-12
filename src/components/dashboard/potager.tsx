"use client";

import { useMemo, type CSSProperties } from "react";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { StatusIcon } from "@/components/kit/status-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/constants";
import { useMembersMap } from "@/lib/hooks";
import { ui } from "@/lib/store";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";

/** How ripe a task's tomato is. A blocked one has stopped ripening: it stays green, and is flagged. */
export const RIPENESS: Record<TaskStatus, number> = { todo: 0, blocked: 0, in_progress: 1, review: 2, done: 3 };
/** Ripe first: read from the left, the row is also a progress bar. */
export const HARVEST_ORDER: TaskStatus[] = ["done", "review", "in_progress", "blocked", "todo"];

/** One tomato as a status mark, with the flag of a blocked task. */
export function StatusTomato({ status, size = 16, className }: { status: TaskStatus; size?: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", status === "blocked" && "potager-stalled", className)}>
      <PixelTomato size={size} stage={RIPENESS[status]} decorative />
      {status === "blocked" && (
        <StatusIcon
          status="blocked"
          size={Math.max(10, Math.round(size * 0.42))}
          className="absolute -right-[3px] -bottom-[2px] rounded-full ring-[1.5px] ring-white/90"
        />
      )}
    </span>
  );
}

/**
 * The week's priorities as a tomato patch: one tomato each, as ripe as its
 * status (green to do, turning under way, orange in review, red done). A
 * picture of the week that is also a set of buttons: each opens its task.
 */
export function Potager({ tasks, size = 32, className }: { tasks: Task[]; size?: number; className?: string }) {
  const members = useMembersMap();
  const plants = useMemo(
    () => [...tasks].sort((a, b) => HARVEST_ORDER.indexOf(a.status) - HARVEST_ORDER.indexOf(b.status)),
    [tasks],
  );
  return (
    <ul className={cn("potager", className)} aria-label="Les priorités de la semaine, une tomate chacune">
      {plants.map((task, i) => {
        const who = task.assignee_id ? members[task.assignee_id] : null;
        const status = STATUS_META[task.status].label;
        return (
          <li key={task.id} className="gw-pop" style={{ "--i": i } as CSSProperties}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => ui.openTask(task.id)}
                  aria-label={`${task.title} : ${status}${who ? `, ${firstName(who.full_name)}` : ""}`}
                  className="potager-plant focus-ring"
                >
                  {/* Keyed by status: when it changes, the new tomato pops in. */}
                  <StatusTomato key={task.status} status={task.status} size={size} className="animate-pop" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <span className="block font-medium">{task.title}</span>
                <span className="block opacity-75">
                  {status}
                  {who ? ` · ${firstName(who.full_name)}` : ""}
                </span>
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
