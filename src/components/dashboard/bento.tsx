import { cn } from "@/lib/utils";

/** A dashboard panel: a translucent surface laid on the glass window. */
export function Tile({
  className,
  children,
  delay = 0,
  ...props
}: React.ComponentProps<"section"> & { delay?: number }) {
  return (
    <section
      className={cn("card-surface gw-reveal min-w-0", className)}
      style={{ animationDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </section>
  );
}

/** Panel heading: a title, an optional line of context, an optional control on the right. */
export function TileHeader({
  title,
  hint,
  action,
  lead,
  className,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  /** A mark before the title. Rare on purpose: only where it says something (the ripening tomato). */
  lead?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start gap-3 px-5 pt-4.5 pb-2", className)}>
      {lead}
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] leading-tight font-semibold text-navy-900">{title}</h2>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </header>
  );
}
