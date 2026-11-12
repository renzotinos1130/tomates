import { cn } from "@/lib/utils";

/** A hairline of progress: ink for what is done, a faint track for the rest. */
export function ProgressLine({
  done,
  total,
  label,
  className,
}: {
  done: number;
  total: number;
  /** Accessible description, e.g. "4 tâches terminées sur 13". */
  label: string;
  className?: string;
}) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className={cn("h-[3px] overflow-hidden rounded-full bg-navy-900/[0.09]", className)}
    >
      <div className="h-full rounded-full bg-navy-900 transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
