"use client";

import { useMemo, type CSSProperties } from "react";
import { HARVEST_ORDER, StatusTomato } from "@/components/kit/status-tomato";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_META } from "@/lib/constants";
import { useMembersMap } from "@/lib/hooks";
import { ui } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";

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

export { HARVEST_ORDER, RIPENESS, StatusTomato } from "@/components/kit/status-tomato";
