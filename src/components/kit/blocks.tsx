import { STATUS_META } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface BlockGroup {
  count: number;
  /** CSS colour of the blocks. */
  color: string;
  /** What the blocks stand for, e.g. "En cours" (used in the description). */
  label: string;
}

const SIZES = {
  xs: { box: 6, gap: 2 },
  sm: { box: 8, gap: 2 },
  md: { box: 10, gap: 3 },
} as const;

/**
 * One block = one thing you can count (a task, a priority). The house way to
 * show small quantities: it reads like the pixels of the logo and, unlike a
 * percentage bar, it can be counted at a glance. Above `max` blocks it falls
 * back to a proportional bar made of the same square-ended segments.
 */
export function Blocks({
  groups,
  size = "sm",
  max = 48,
  wrap = true,
  className,
  label,
}: {
  groups: BlockGroup[];
  size?: keyof typeof SIZES;
  max?: number;
  wrap?: boolean;
  className?: string;
  /** Accessible summary; defaults to "3 En cours, 2 À faire". */
  label?: string;
}) {
  const s = SIZES[size];
  const visible = groups.filter((g) => g.count > 0);
  const total = visible.reduce((n, g) => n + g.count, 0);
  const description = label ?? (visible.map((g) => `${g.count} ${g.label}`).join(", ") || "Aucun élément");

  if (total === 0) {
    return (
      <div role="img" aria-label={description} className={cn("flex", className)} style={{ gap: s.gap }}>
        <span className="rounded-[2px] bg-navy-900/10" style={{ width: s.box, height: s.box }} />
      </div>
    );
  }

  if (total > max) {
    return (
      <div
        role="img"
        aria-label={description}
        className={cn("flex w-full overflow-hidden rounded-[2px]", className)}
        style={{ gap: s.gap, height: s.box }}
      >
        {visible.map((g) => (
          <span key={g.label} title={`${g.label} : ${g.count}`} style={{ flex: g.count, background: g.color }} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={description}
      className={cn("flex", wrap && "flex-wrap", className)}
      style={{ gap: s.gap }}
    >
      {visible.flatMap((g) =>
        Array.from({ length: g.count }, (_, i) => (
          <span
            key={`${g.label}-${i}`}
            title={`${g.label} : ${g.count}`}
            className="shrink-0 rounded-[2px]"
            style={{ width: s.box, height: s.box, background: g.color }}
          />
        )),
      )}
    </div>
  );
}

/** Reading order of a status breakdown: what is finished first, what waits last. */
const STATUS_ORDER: TaskStatus[] = ["done", "review", "in_progress", "blocked", "todo"];

/** Colour of a status when drawn as a block ("à faire" is a quiet, empty-looking cell). */
export function statusBlockColor(status: TaskStatus): string {
  return status === "todo" ? "rgb(13 27 51 / 0.14)" : STATUS_META[status].hex;
}

/** Tasks drawn as blocks, coloured by status. */
export function StatusBlocks({
  byStatus,
  order = STATUS_ORDER,
  ...props
}: {
  byStatus: Record<TaskStatus, number>;
  order?: TaskStatus[];
} & Omit<React.ComponentProps<typeof Blocks>, "groups">) {
  return (
    <Blocks
      groups={order.map((status) => ({
        count: byStatus[status] ?? 0,
        color: statusBlockColor(status),
        label: STATUS_META[status].label.toLowerCase(),
      }))}
      {...props}
    />
  );
}
