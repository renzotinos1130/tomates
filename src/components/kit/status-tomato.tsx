import { PixelTomato } from "@/components/kit/pixel-tomato";
import { StatusIcon } from "@/components/kit/status-icon";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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
