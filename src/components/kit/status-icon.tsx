import { STATUS_META } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILL: Record<TaskStatus, number> = { todo: 0, in_progress: 0.5, review: 0.75, blocked: 1, done: 1 };

/**
 * Linear-style status glyph: an outlined ring that fills up as the work
 * progresses. Colour comes from the status token, so it works on any surface.
 */
export function StatusIcon({
  status,
  size = 16,
  className,
}: {
  status: TaskStatus;
  size?: number;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const fill = FILL[status];
  const c = 2 * Math.PI * 2; // pie drawn with a thick stroke on r=2
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", meta.solid, className)}
    >
      {status === "done" || status === "blocked" ? (
        <circle cx="8" cy="8" r="7" fill="currentColor" />
      ) : (
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      )}
      {fill > 0 && fill < 1 && (
        <circle
          cx="8"
          cy="8"
          r="2"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={`${fill * c} ${c}`}
          transform="rotate(-90 8 8)"
        />
      )}
      {status === "done" && (
        <path d="M4.9 8.3l2.1 2.1 4.1-4.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === "blocked" && <path d="M5 8h6" stroke="white" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}
