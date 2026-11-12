"use client";

import { Check, ChevronRight, Layers, RotateCcw, Settings2 } from "lucide-react";
import { useCallback, useMemo, type CSSProperties } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BACKDROPS, GLASS_DEFAULTS, GLASS_PRESETS, normalizeGlass, parseGlass, type GlassSettings } from "@/lib/glass";
import { useLocalState } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const DEFAULT_JSON = JSON.stringify(GLASS_DEFAULTS);
/** v2: a backdrop now brings its own frost. Settings saved before that are left behind. */
const STORAGE_KEY = "tthq:glass:v2";

/** The member's glass settings, the CSS variables that apply them, and a setter. */
export function useGlass() {
  const [raw, setRaw] = useLocalState<string>(STORAGE_KEY, DEFAULT_JSON);
  const settings = useMemo(() => parseGlass(raw), [raw]);
  const update = useCallback(
    (patch: Partial<GlassSettings>) => setRaw(JSON.stringify(normalizeGlass({ ...parseGlass(raw), ...patch }))),
    [raw, setRaw],
  );
  const reset = useCallback(() => setRaw(DEFAULT_JSON), [setRaw]);
  const vars = useMemo(
    () =>
      ({
        "--gw-blur": `${settings.blur}px`,
        "--gw-opacity": settings.opacity,
        "--gw-saturation": settings.saturation,
        "--gw-edge": settings.edge,
        "--gw-tint": settings.tint,
      }) as CSSProperties,
    [settings],
  );
  return { settings, update, reset, vars };
}

/** Scene behind the whole app: the navigation and the window are frosted over it. */
export function GlassBackdrop({ settings }: { settings: GlassSettings }) {
  const backdrop = BACKDROPS.find((b) => b.id === settings.background) ?? BACKDROPS[0];
  if (backdrop.id === "papier") return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: backdrop.tone }}
    >
      {backdrop.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={backdrop.src}
          src={backdrop.src}
          alt=""
          decoding="async"
          fetchPriority="high"
          className={cn("size-full object-cover", backdrop.pixel ? "pixelated object-bottom" : "object-[center_56%]")}
        />
      )}
      {/* A light shade keeps the scene calm behind the glass. */}
      <div className="absolute inset-0 bg-paper-50" style={{ opacity: backdrop.shade ?? 0.2 }} />
    </div>
  );
}

/**
 * A page that stands outside the workspace (sign-in) on the same scene, with
 * the member's own glass settings.
 */
export function GlassScene({ className, children }: { className?: string; children: React.ReactNode }) {
  const glass = useGlass();
  return (
    <div className={cn("gw-scope app-canvas relative overflow-hidden", className)} style={glass.vars}>
      <GlassBackdrop settings={glass.settings} />
      {children}
    </div>
  );
}

const SLIDERS: {
  key: "blur" | "opacity" | "saturation" | "edge";
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}[] = [
  { key: "blur", label: "Flou", min: 0, max: 40, step: 1, format: (v) => `${Math.round(v)} px` },
  { key: "opacity", label: "Opacité", min: 0.08, max: 0.9, step: 0.01, format: (v) => `${Math.round(v * 100)} %` },
  { key: "saturation", label: "Saturation", min: 0.5, max: 2, step: 0.05, format: (v) => `${Math.round(v * 100)} %` },
  { key: "edge", label: "Reflet des bords", min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)} %` },
];

/** "Ajuster le verre": backdrop, presets and the four material sliders. */
export function GlassSettingsButton({
  settings,
  update,
  reset,
  labelled = false,
}: {
  settings: GlassSettings;
  update: (patch: Partial<GlassSettings>) => void;
  reset: () => void;
  /** Show the words next to the icon (dashboard toolbar). Icon only otherwise. */
  labelled?: boolean;
}) {
  const current = BACKDROPS.find((b) => b.id === settings.background);
  return (
    <Popover>
      <PopoverTrigger asChild>
        {labelled ? (
          <button
            type="button"
            className="flex h-[34px] shrink-0 items-center gap-2 rounded-[9px] px-2.5 text-[13px] text-navy-800 transition-colors hover:bg-white/30 focus-ring data-[state=open]:bg-white/40"
          >
            <Settings2 className="size-4" />
            Ajuster le verre
          </button>
        ) : (
          <button
            type="button"
            aria-label="Ajuster le verre"
            title="Ajuster le verre"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-navy-500 transition-colors hover:bg-white/30 hover:text-navy-900 focus-ring data-[state=open]:bg-white/40 data-[state=open]:text-navy-900"
          >
            <Settings2 className="size-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={labelled ? "bottom" : "top"}
        align="end"
        sideOffset={10}
        className="gw-popover w-[304px] gap-0 rounded-[22px] p-[22px] shadow-pop"
      >
        <div className="flex items-center gap-2.5">
          <Settings2 className="size-[18px] text-navy-700" />
          <h2 className="text-[15px] font-semibold tracking-tight text-navy-900">Apparence du verre</h2>
        </div>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">Un choix personnel, gardé dans ce navigateur.</p>

        {/* Live sample of the material */}
        <div
          aria-hidden="true"
          className={cn(
            "gw-scope mb-4 flex h-[76px] items-center justify-center gap-3 overflow-hidden rounded-xl bg-paper-200 bg-cover",
            current?.pixel ? "pixelated bg-bottom" : "bg-center",
          )}
          style={{ backgroundImage: current?.thumb ? `url(${current.thumb})` : undefined }}
        >
          <div className="flex size-full items-center justify-center gap-2.5 text-xs font-medium text-navy-800">
            <span
              className="gw-glass flex items-center gap-2 rounded-xl px-3 py-2"
              style={
                {
                  "--gw-blur": `${settings.blur / 3}px`,
                  "--gw-opacity": settings.opacity,
                  "--gw-saturation": settings.saturation,
                  "--gw-edge": settings.edge,
                  "--gw-tint": settings.tint,
                } as CSSProperties
              }
            >
              <Layers className="size-4" strokeWidth={1.5} /> Aperçu
            </span>
          </div>
        </div>

        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Arrière-plan</div>
        <div className="mb-4 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Arrière-plan">
          {BACKDROPS.map((b) => {
            const on = settings.background === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={b.label}
                title={b.label}
                // Each scene comes with the frost that suits it.
                onClick={() => update({ background: b.id, ...b.frost })}
                className={cn(
                  "relative h-9 overflow-hidden rounded-lg bg-cover ring-1 ring-navy-900/10 transition-all focus-ring",
                  b.pixel ? "pixelated bg-bottom" : "bg-center",
                  b.id === "papier" && "bg-paper-100",
                  on && "ring-2 ring-navy-900 ring-offset-2 ring-offset-paper-50",
                )}
                style={b.thumb ? { backgroundImage: `url(${b.thumb})` } : undefined}
              >
                {on && (
                  <span className="absolute inset-0 flex items-center justify-center bg-navy-900/25 text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex gap-1.5" role="group" aria-label="Préréglages">
          {GLASS_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => update(p.value)}
              className="h-8 flex-1 rounded-lg border border-navy-900/10 bg-card/60 text-xs font-medium text-navy-700 transition-colors hover:bg-card focus-ring"
            >
              {p.name}
            </button>
          ))}
        </div>

        <details className="group/fine mb-1">
          <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg text-xs font-medium text-navy-700 focus-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 text-navy-400 transition-transform group-open/fine:rotate-90" />
            Réglages fins
          </summary>
          <div className="pt-2 pb-1">
            {SLIDERS.map((s) => (
              <label key={s.key} className="mb-3.5 block">
                <span className="flex justify-between text-xs text-navy-800">
                  {s.label}
                  <output className="text-[11px] text-muted-foreground tabular">{s.format(settings[s.key])}</output>
                </span>
                <input
                  type="range"
                  aria-label={s.label}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={settings[s.key]}
                  onChange={(e) => update({ [s.key]: Number(e.target.value) })}
                  className="mt-2 block h-4 w-full cursor-pointer accent-navy-900"
                />
              </label>
            ))}

            <label className="mt-1 flex items-center justify-between text-xs text-navy-800">
              Teinte du verre
              <input
                type="color"
                aria-label="Teinte du verre"
                value={settings.tint}
                onChange={(e) => update({ tint: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded-md border border-navy-900/10 bg-transparent p-0.5"
              />
            </label>
          </div>
        </details>

        <button
          type="button"
          onClick={reset}
          className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-navy-900/10 text-xs font-medium text-navy-700 transition-colors hover:bg-card/70 focus-ring"
        >
          <RotateCcw className="size-3.5" /> Réinitialiser
        </button>
      </PopoverContent>
    </Popover>
  );
}
