import { PixelTomato } from "@/components/kit/pixel-tomato";
import { cn } from "@/lib/utils";

/**
 * First-load screen. The scene is in full view (the navigation and the window
 * wait, see `data-preloading`) and, over it, a small plate of frosted glass:
 * the pixel tomato drops in, does a salto, then keeps hopping (a salto every
 * other jump) over a row of loading blocks. Then the plate goes and the app
 * comes in over the same scene. Pure CSS, so it already moves in the
 * server-rendered shell, before any script runs.
 */
export function Preloader({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={cn("preloader", leaving && "preloader-leaving")}
      role="status"
      aria-live="polite"
      aria-label="Chargement de Team Tomate HQ"
    >
      <div className="preloader-plate">
        <div className="preloader-stage" aria-hidden="true">
          <div className="preloader-tomato">
            <div className="preloader-spin">
              <PixelTomato size={128} decorative />
            </div>
          </div>
          <div className="preloader-shadow" />
        </div>
        <div className="preloader-blocks" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <p className="preloader-hint">Ça mijote…</p>
      </div>
    </div>
  );
}
