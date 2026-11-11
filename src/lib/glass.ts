/**
 * "Verre ajustable" — the dashboard's material. Each member tunes it to
 * taste; the settings live in their browser (a visual preference, not team
 * data).
 */
export type BackdropId = "vallee" | "lac" | "rivage" | "aurore" | "papier";

export interface GlassSettings {
  background: BackdropId;
  /** Backdrop blur in px (0–40). */
  blur: number;
  /** Surface opacity (0.08–0.9). Higher = more legible, less see-through. */
  opacity: number;
  /** Backdrop saturation (0.5–2). */
  saturation: number;
  /** Strength of the light edge around panels (0–1). */
  edge: number;
  /** Tint mixed into the glass, `#rrggbb`. */
  tint: string;
}

export const GLASS_DEFAULTS: GlassSettings = {
  background: "vallee",
  blur: 24,
  opacity: 0.56,
  saturation: 1.3,
  edge: 0.7,
  tint: "#ffffff",
};

export const GLASS_PRESETS: { name: string; value: Partial<GlassSettings> }[] = [
  { name: "Clair", value: { blur: 10, opacity: 0.26, saturation: 1.15, edge: 0.85 } },
  { name: "Givré", value: { blur: 24, opacity: 0.56, saturation: 1.3, edge: 0.7 } },
  { name: "Opaque", value: { blur: 32, opacity: 0.9, saturation: 1, edge: 0.4 } },
];

export const BACKDROPS: { id: BackdropId; label: string; src?: string; thumb?: string }[] = [
  { id: "vallee", label: "Vallée", src: "/backgrounds/vallee.webp", thumb: "/backgrounds/vallee-thumb.webp" },
  { id: "lac", label: "Lac", src: "/backgrounds/lac.webp", thumb: "/backgrounds/lac-thumb.webp" },
  { id: "rivage", label: "Rivage", src: "/backgrounds/rivage.webp", thumb: "/backgrounds/rivage-thumb.webp" },
  { id: "aurore", label: "Aurore" },
  { id: "papier", label: "Papier" },
];

const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Accepts anything (stored JSON, partial patch) and returns safe settings. */
export function normalizeGlass(v: Partial<GlassSettings> | null | undefined): GlassSettings {
  const d = GLASS_DEFAULTS;
  return {
    background: BACKDROPS.some((b) => b.id === v?.background) ? (v!.background as BackdropId) : d.background,
    blur: bounded(v?.blur, 0, 40, d.blur),
    opacity: bounded(v?.opacity, 0.08, 0.9, d.opacity),
    saturation: bounded(v?.saturation, 0.5, 2, d.saturation),
    edge: bounded(v?.edge, 0, 1, d.edge),
    tint: typeof v?.tint === "string" && /^#[0-9a-f]{6}$/i.test(v.tint) ? v.tint : d.tint,
  };
}

export function parseGlass(raw: string): GlassSettings {
  try {
    return normalizeGlass(JSON.parse(raw) as Partial<GlassSettings>);
  } catch {
    return GLASS_DEFAULTS;
  }
}
