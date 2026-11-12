/**
 * "Verre ajustable" — the dashboard's material. Each member tunes it to
 * taste; the settings live in their browser (a visual preference, not team
 * data).
 */
export type BackdropId = "ferme" | "yacht";

export interface GlassSettings {
  background: BackdropId;
  /** How much the picture behind the app is blurred, in px (0–40). The glass itself stays clear. */
  blur: number;
  /** Opacity of the glass (0.08–0.9). Higher = more legible, less see-through. */
  opacity: number;
  /** Saturation of the picture (0.5–2). */
  saturation: number;
  /** Strength of the ring around sheets and tiles (0–1). */
  edge: number;
  /** Tint mixed into the glass, `#rrggbb`. */
  tint: string;
}

/** How frosted the glass is: the part of the settings a backdrop has an opinion about. */
type Frost = Pick<GlassSettings, "blur" | "opacity" | "saturation">;

/**
 * The team's pictures are busy and colourful. The frost is on the PICTURE: once
 * the app is in, the scene behind it is blurred into soft shapes. The glass on
 * top can then stay clear: a light face inside its polished ring.
 */
const SCENE_FROST: Frost = { blur: 18, opacity: 0.5, saturation: 1.15 };

/** The default is the team's tomato farm, frosted, under clear polished glass. */
export const GLASS_DEFAULTS: GlassSettings = {
  background: "ferme",
  ...SCENE_FROST,
  edge: 0.6,
  tint: "#ffffff",
};

export const GLASS_PRESETS: { name: string; value: Partial<GlassSettings> }[] = [
  { name: "Clair", value: { blur: 10, opacity: 0.3, saturation: 1.15, edge: 0.8 } },
  // The app's own look: the picture frosted, the polished glass of Koloc Cloud kept clear.
  { name: "Poli", value: { blur: 18, opacity: 0.5, saturation: 1.15, edge: 0.6 } },
  { name: "Givré", value: { blur: 30, opacity: 0.68, saturation: 1.1, edge: 0.6 } },
  { name: "Opaque", value: { blur: 32, opacity: 0.86, saturation: 1, edge: 0.35 } },
];

export interface Backdrop {
  id: BackdropId;
  label: string;
  src: string;
  thumb: string;
  /** Average colour of the scene: what shows while the picture loads. */
  tone: string;
  /** The frost that suits this scene. Choosing the backdrop applies it; presets and sliders adjust from there. */
  frost: Frost;
}

/** The team's two pictures. The first is the one the app opens on. */
export const BACKDROPS: Backdrop[] = [
  // At work on the tomato farm.
  {
    id: "ferme",
    label: "La ferme",
    src: "/backgrounds/ferme.webp",
    thumb: "/backgrounds/ferme-thumb.webp",
    tone: "#83845d",
    frost: SCENE_FROST,
  },
  // On the yacht at sunset.
  {
    id: "yacht",
    label: "Le yacht",
    src: "/backgrounds/yacht.webp",
    thumb: "/backgrounds/yacht-thumb.webp",
    tone: "#985632",
    frost: SCENE_FROST,
  },
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
