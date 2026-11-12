import { PixelText } from "@/components/kit/pixel-text";
import { PixelTomato } from "@/components/kit/pixel-tomato";
import { cn } from "@/lib/utils";

/**
 * First-load screen: the pixel tomato drops in, then keeps bouncing (with a
 * flip every other jump) over a row of loading blocks. Pure CSS, so it
 * already moves in the server-rendered shell, before any script runs.
 */
export function Preloader({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={cn("preloader pixel-night", leaving && "preloader-leaving")}
      role="status"
      aria-live="polite"
      aria-label="Chargement de Team Tomate HQ"
    >
      <div className="preloader-stage" aria-hidden="true">
        <div className="preloader-tomato">
          <PixelTomato size={96} decorative />
        </div>
        <div className="preloader-shadow" />
      </div>
      <div className="preloader-blocks" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="preloader-name" aria-hidden="true">
        <PixelText text="Team Tomate HQ" unit={3} shadow="var(--color-tomato-700)" decorative />
      </div>
      <p className="preloader-hint">Ça mijote…</p>
    </div>
  );
}
