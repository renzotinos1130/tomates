import { cn } from "@/lib/utils";

/**
 * A tile of the dashboard: glass laid on the scene, a title row, then the
 * content. Tiles arrive one after the other (`delay`). Three kinds of title:
 * a heading (the default), a quiet label over a tile that is one figure, and
 * the larger heading of the tile the page is built around (`hero`).
 */
export function Panel({
  title,
  description,
  quiet = false,
  hero = false,
  lead,
  aside,
  children,
  className,
  delay = 0,
}: {
  title: string;
  /** One quiet line under the title, saying what the tile holds. */
  description?: string;
  /** A small muted label instead of a heading: for a tile that is one figure. */
  quiet?: boolean;
  /** The main tile of the page: a larger heading. */
  hero?: boolean;
  /** A small mark before the title (the ripening tomato). */
  lead?: React.ReactNode;
  /** Quiet text, icon or link on the right of the title. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section className={cn("gw-panel gw-reveal @container/panel", className)} style={{ animationDelay: `${delay}ms` }}>
      <header className={cn("gw-panel-title", description && !hero && "items-start", hero && "gw-panel-hero")}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {lead}
            {quiet ? <h2 className="gw-panel-label truncate">{title}</h2> : <h2 className="truncate">{title}</h2>}
          </div>
          {description && !hero && <p className="mt-1 text-xs leading-4 text-navy-600">{description}</p>}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-1.5">{aside}</div>}
      </header>
      {/* Under a large heading the line runs the whole width of the tile, not just beside the aside. */}
      {description && hero && <p className="mb-5 text-xs leading-4 text-navy-600">{description}</p>}
      {children}
    </section>
  );
}

/** "Tout voir →": the small text link on the right of a panel title. */
export const PANEL_LINK =
  "flex items-center gap-1.5 rounded-md text-xs text-navy-700 transition-colors hover:text-navy-900 focus-ring";
