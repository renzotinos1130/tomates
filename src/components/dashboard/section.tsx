import { cn } from "@/lib/utils";

/**
 * A dashboard section: a hairline, a small heading, then the content laid
 * straight on the window. No box around it.
 */
export function Section({
  title,
  lead,
  aside,
  children,
  className,
  delay = 0,
}: {
  title: string;
  /** A small mark before the title (the ripening tomato). */
  lead?: React.ReactNode;
  /** Quiet text or control on the right of the heading. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn("gw-reveal min-w-0 border-t border-navy-900/[0.09] pt-4", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="mb-2 flex min-h-5 items-center gap-2">
        {lead}
        <h2 className="text-[13px] font-semibold text-navy-900">{title}</h2>
        {aside && <div className="ml-auto text-xs text-navy-400 tabular">{aside}</div>}
      </header>
      {children}
    </section>
  );
}
