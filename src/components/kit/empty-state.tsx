import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-center", className)}>
      {icon && <div className="mb-1.5 flex items-center justify-center text-navy-400 [&_svg.icon]:size-5">{icon}</div>}
      <p className="text-[13px] font-medium text-navy-800">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
