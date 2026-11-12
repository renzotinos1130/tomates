"use client";

import { useMemo } from "react";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { TaskLine } from "@/components/tasks/task-line";
import { todayDateOnly } from "@/lib/dates";
import { useAllTasks, useNow } from "@/lib/hooks";
import { atRiskTasks } from "@/lib/selectors";
import { cn, plural } from "@/lib/utils";
import { Figure } from "./figure";
import { Panel } from "./panel";
import { useFitRows } from "./use-fit-rows";

/**
 * What needs a hand, for the whole team: the tasks that are blocked or past
 * their date, how many, and the first ones — a click away from being dealt with.
 */
export function AtRisk({ className, delay }: { className?: string; delay?: number }) {
  const now = useNow();
  const tasks = useAllTasks();
  const today = todayDateOnly(now);
  const risky = useMemo(() => atRiskTasks(tasks, today), [tasks, today]);
  // Two groups that add up to the figure: a blocked task that is also late is counted as blocked.
  const blocked = risky.filter((t) => t.status === "blocked").length;
  const late = risky.length - blocked;
  const rows = useFitRows<HTMLDivElement>();
  const parts = [blocked > 0 && plural(blocked, "bloquée"), late > 0 && `${late} en retard`].filter(Boolean);

  return (
    <Panel
      className={cn("flex flex-col", className)}
      delay={delay}
      quiet
      title="À débloquer"
      aside={risky.length > 0 ? <i aria-hidden="true" className="size-2 rounded-full bg-coral-500" /> : undefined}
    >
      <p>
        {/* The one figure of the page drawn in red: it is the one that asks for something. */}
        <Figure value={risky.length} className={risky.length > 0 ? "text-tomato-700" : undefined} />
      </p>
      <p className="mt-3 text-xs leading-5 text-navy-600">
        {risky.length === 0 ? "Rien ne coince : aucune tâche bloquée ni en retard." : `${parts.join(" · ")}, dans toute l'équipe`}
      </p>
      {risky.length > 0 ? (
        // On its own row (a phone) it shows three; beside other tiles, what their height allows.
        <div ref={rows} className="gw-rows gw-fit mt-3 min-h-[176px] flex-1 basis-0 @3xl/dash:min-h-[112px]">
          {risky.slice(0, 8).map((t) => (
            <TaskLine
              key={t.id}
              task={t}
              show={{ lead: "status", status: false, project: false }}
              className="min-h-11 hover:bg-white/35"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-5">
          <PixelTomato size={48} decorative />
        </div>
      )}
    </Panel>
  );
}
