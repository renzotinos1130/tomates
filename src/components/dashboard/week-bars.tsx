import type { CSSProperties } from "react";
import { formatShortDate, parseDateOnly } from "@/lib/dates";
import type { WeekCount } from "@/lib/selectors";
import { cn } from "@/lib/utils";

/**
 * Tasks finished per week, one bar per week (Wednesday to Tuesday), the count
 * sitting on each bar and the date under it. The week in progress is the teal one.
 */
export function WeekBars({ weeks, className }: { weeks: WeekCount[]; className?: string }) {
  const top = Math.max(1, ...weeks.map((w) => w.done));
  return (
    <ol className={cn("week-bars", className)} aria-label="Tâches terminées par semaine, de la plus ancienne à celle en cours">
      {weeks.map((w, i) => {
        const last = i === weeks.length - 1;
        const date = formatShortDate(parseDateOnly(w.start));
        return (
          <li key={w.start} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="week-track" style={{ "--h": `${(w.done / top) * 100}%`, "--i": i } as CSSProperties}>
              <span className={cn("week-count", last ? "font-medium text-navy-900" : "text-navy-600")}>
                <span className="sr-only">Semaine du {date} : </span>
                {w.done}
                <span className="sr-only"> {w.done >= 2 ? "tâches terminées" : "tâche terminée"}</span>
              </span>
              <span aria-hidden="true" className={cn("week-bar gw-pop", last ? "bg-teal-500" : "bg-navy-900/[0.16]")} />
            </span>
            <span
              aria-hidden="true"
              className={cn("text-[10px] leading-none whitespace-nowrap", last ? "font-medium text-navy-900" : "text-navy-600")}
            >
              {date}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
