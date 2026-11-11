import { cn } from "@/lib/utils";

/** A bento tile: white surface, hairline border, soft shadow. */
export function Tile({
  className,
  children,
  delay = 0,
  ...props
}: React.ComponentProps<"section"> & { delay?: number }) {
  return (
    <section
      className={cn("card-surface animate-fade-up min-w-0", className)}
      style={{ animationDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </section>
  );
}

export function TileHeader({
  title,
  hint,
  action,
  icon,
  className,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start gap-3 px-5 pt-4.5 pb-2", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <h2 className="text-[14px] leading-tight font-semibold text-navy-900">{title}</h2>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </header>
  );
}
