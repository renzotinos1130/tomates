/**
 * "Verre ajustable" — the dashboard's material. Each member tunes it to
 * taste; the settings live in their browser (a visual preference, not team
 * data).
 */
export type BackdropId = "ferme" | "potager" | "vallee" | "lac" | "rivage" | "papier";

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

/** How frosted the glass is: the part of the settings a backdrop has an opinion about. */
type Frost = Pick<GlassSettings, "blur" | "opacity" | "saturation">;

/**
 * The farm is the team's own picture: a light blur, so one still makes out the
 * field, the stall and who is at work behind the glass, and a fuller sheet than
 * for the other pictures, because it is busy and text has to sit on it.
 */
const SCENE_FROST: Frost = { blur: 5, opacity: 0.58, saturation: 1.1 };
/** A photograph wants a heavy frost: it becomes soft light and colour. */
const PHOTO_FROST: Frost = { blur: 22, opacity: 0.3, saturation: 1.2 };
/** Pixel art wants a light one: you still make out the clouds, the hills and the tomato plants. */
const PIXEL_FROST: Frost = { blur: 5, opacity: 0.36, saturation: 1.15 };
/** Plain paper has nothing to show through: the sheets are nearly opaque. */
const PAPER_FROST: Frost = { blur: 24, opacity: 0.8, saturation: 1 };

/** The default is the team's tomato farm, seen through frosted glass. */
export const GLASS_DEFAULTS: GlassSettings = {
  background: "ferme",
  ...SCENE_FROST,
  edge: 0.6,
  tint: "#ffffff",
};

export const GLASS_PRESETS: { name: string; value: Partial<GlassSettings> }[] = [
  { name: "Clair", value: { blur: 8, opacity: 0.12, saturation: 1.1, edge: 0.8 } },
  { name: "Givré", value: { blur: 22, opacity: 0.3, saturation: 1.2, edge: 0.6 } },
  { name: "Opaque", value: { blur: 32, opacity: 0.86, saturation: 1, edge: 0.35 } },
];

export interface Backdrop {
  id: BackdropId;
  label: string;
  src?: string;
  thumb?: string;
  /** Pixel art: scaled up without smoothing, anchored to the bottom. */
  pixel?: boolean;
  /** Average colour of the scene: what the glass shows while the picture loads. */
  tone?: string;
  /** How much light is laid over the scene (0–1). Darker pictures get more, so text stays readable. */
  shade?: number;
  /** The frost that suits this scene. Choosing the backdrop applies it; presets and sliders adjust from there. */
  frost: Frost;
}

export const BACKDROPS: Backdrop[] = [
  // The team at work on its tomato farm: the picture the app opens on.
  {
    id: "ferme",
    label: "La ferme",
    src: "/backgrounds/ferme.webp",
    thumb: "/backgrounds/ferme-thumb.webp",
    tone: "#83845d",
    shade: 0,
    frost: SCENE_FROST,
  },
  // Drawn for the project (scripts/pixel-backdrop.py): a tomato garden under soft hills.
  {
    id: "potager",
    label: "Potager",
    src: "/backgrounds/potager.png",
    thumb: "/backgrounds/potager.png",
    pixel: true,
    tone: "#99c6b8",
    shade: 0.14,
    frost: PIXEL_FROST,
  },
  {
    id: "rivage",
    label: "Rivage",
    src: "/backgrounds/rivage.webp",
    thumb: "/backgrounds/rivage-thumb.webp",
    tone: "#b9bab2",
    shade: 0.16,
    frost: PHOTO_FROST,
  },
  {
    id: "vallee",
    label: "Vallée",
    src: "/backgrounds/vallee.webp",
    thumb: "/backgrounds/vallee-thumb.webp",
    tone: "#849599",
    shade: 0.24,
    frost: PHOTO_FROST,
  },
  {
    id: "lac",
    label: "Lac",
    src: "/backgrounds/lac.webp",
    thumb: "/backgrounds/lac-thumb.webp",
    tone: "#605b59",
    shade: 0.36,
    frost: PHOTO_FROST,
  },
  { id: "papier", label: "Papier", frost: PAPER_FROST },
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
