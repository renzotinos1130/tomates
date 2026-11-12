import { CalendarDays, Star } from "lucide-react";
import { PRIORITY_META, STATUS_META } from "@/lib/constants";
import { describeDue } from "@/lib/dates";
import type { DateOnly, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityIcon } from "./priority-icon";
import { StatusIcon } from "./status-icon";

/**
 * A status as it is written everywhere: the glyph carries the colour, the
 * label stays in ink. No tinted capsule — a board full of them turns into
 * confetti.
 */
export function StatusLabel({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium whitespace-nowrap",
        meta.text,
        className,
      )}
    >
      <StatusIcon status={status} size={14} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

export function PriorityPill({
  priority,
  className,
  showLabel = true,
}: {
  priority: TaskPriority;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  if (!showLabel) return <PriorityIcon priority={priority} className={className} />;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-navy-700", className)}>
      <PriorityIcon priority={priority} size={14} />
      {meta.label}
    </span>
  );
}

const DUE_TONE = {
  overdue: "text-coral-600",
  today: "font-medium text-navy-900",
  soon: "text-navy-700",
  later: "text-muted-foreground",
  done: "text-muted-foreground",
} as const;

export function DueLabel({
  date,
  done = false,
  now,
  icon = false,
  className,
}: {
  date: DateOnly | null;
  done?: boolean;
  now: Date;
  icon?: boolean;
  className?: string;
}) {
  if (!date) return null;
  const info = describeDue(date, done, now);
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap tabular", DUE_TONE[info.tone], className)}
      title={info.tone === "overdue" ? `En retard de ${Math.abs(info.days)} j` : undefined}
    >
      {icon && <CalendarDays className="size-3.5 opacity-70" />}
      <span className={cn(info.tone === "overdue" && "font-medium")}>{info.label}</span>
    </span>
  );
}

/** The warm-yellow star marks a "priorité de la semaine". */
export function PriorityStar({ active, className }: { active: boolean; className?: string }) {
  return (
    <Star
      className={cn(
        "size-4 transition-all duration-200",
        active ? "fill-sun-400 text-sun-500" : "text-navy-400/80",
        className,
      )}
      strokeWidth={active ? 1.5 : 1.75}
    />
  );
}

export function CountBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-navy-900/[0.06] px-1.5 text-[11px] font-medium text-navy-600 tabular",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-navy-900/10 bg-paper-100 px-1 font-sans text-[11px] font-medium text-navy-500",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
