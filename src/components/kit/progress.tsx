import { cn } from "@/lib/utils";

/**
 * A line of progress. Ink by default; `accent` draws it in teal on a track of
 * the same hue, for the places where progress is the subject (the dashboard).
 */
export function ProgressLine({
  done,
  total,
  label,
  tone = "ink",
  className,
}: {
  done: number;
  total: number;
  /** Accessible description, e.g. "4 tâches terminées sur 13". */
  label: string;
  tone?: "ink" | "accent";
  className?: string;
}) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const accent = tone === "accent";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className={cn(
        "overflow-hidden rounded-full",
        accent ? "h-[5px] bg-teal-500/[0.18]" : "h-[3px] bg-navy-900/[0.09]",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", accent ? "bg-teal-500" : "bg-navy-900")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
