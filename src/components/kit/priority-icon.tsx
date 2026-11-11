import { PRIORITY_META } from "@/lib/constants";
import type { TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Signal-bars glyph: three bars for Haute, two for Normale, one for Basse. */
export function PriorityIcon({
  priority,
  size = 16,
  className,
}: {
  priority: TaskPriority;
  size?: number;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const bars = [
    { x: 2.5, h: 4.5 },
    { x: 6.75, h: 8 },
    { x: 11, h: 11.5 },
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("shrink-0", meta.color, className)}
    >
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={14 - b.h}
          width="2.5"
          height={b.h}
          rx="1"
          fill="currentColor"
          opacity={i < meta.bars ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}
