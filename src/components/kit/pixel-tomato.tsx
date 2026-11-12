import { cn } from "@/lib/utils";

/**
 * Team Tomate's mark: an original 16×16 pixel-art tomato, in the spirit of
 * blocky game sprites. One character = one pixel.
 */
export const TOMATO_PIXELS = [
  ".........s......",
  "........s.......",
  ".......se.......",
  "....e..gg..e....",
  "....ggyyggge....",
  "...gygeggegge...",
  "..oellreerrreo..",
  ".ollhhrrrrrrrdo.",
  ".olhwrrrrrrrrdo.",
  ".olrrrrrrrrrrdo.",
  ".orrrrrrrrrrrdo.",
  ".odrrrrrrrrddDo.",
  "..oddrrrrdddDo..",
  "...oodddDDDoo...",
  ".....oooooo.....",
  "................",
] as const;

export const TOMATO_PALETTE: Record<string, string> = {
  o: "#5e1410", // outline
  r: "#e63b2b", // tomato red
  d: "#b42a1e", // shade
  D: "#8c1e16", // deep shade
  l: "#ff6b55", // light
  h: "#ffb3a1", // highlight
  w: "#ffe8e0", // sparkle
  g: "#3fa34d", // leaf
  e: "#246e34", // leaf shade
  y: "#83d67f", // leaf light
  s: "#1c542a", // stem
};

/**
 * The fruit ripens in four steps — green, turning, orange, ripe — by swapping
 * its six fruit colours. Used to show how far the week's priorities are.
 */
export const RIPENESS_STAGES = ["verte", "tournante", "presque mûre", "mûre"] as const;
const FRUIT_STAGES: Record<string, string>[] = [
  { o: "#24521a", r: "#6fbf4a", d: "#4f9a35", D: "#3c7d2a", l: "#9bd66f", h: "#c9eeaa", w: "#eefbe0" },
  { o: "#5a4f12", r: "#cdc43f", d: "#a59a2e", D: "#7f7a22", l: "#e4dd6e", h: "#f2efae", w: "#fbf9dc" },
  { o: "#6b2f0c", r: "#f08a2b", d: "#c96a1c", D: "#9c4f14", l: "#ffae5e", h: "#ffd6a8", w: "#ffeed8" },
  {},
];

/** 0 → green, 1 → ripe. The last step is only reached when everything is done. */
export function ripenessStage(done: number, total: number): number {
  if (total <= 0 || done <= 0) return 0;
  if (done >= total) return 3;
  return done / total >= 0.5 ? 2 : 1;
}

/** Rows 0–5 are the stem and leaves, the rest is the fruit. */
const LEAF_ROWS = 6;
const LEAF_CHARS = new Set(["g", "e", "y", "s"]);

interface Run {
  x: number;
  y: number;
  w: number;
  /** Palette key of the pixels in this run. */
  ch: string;
  fill: string;
  leaf: boolean;
}

/** Horizontal runs of identical pixels: fewer rectangles, same picture. */
function runs(): Run[] {
  const out: Run[] = [];
  TOMATO_PIXELS.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      out.push({ x, y, w, ch, fill: TOMATO_PALETTE[ch], leaf: LEAF_CHARS.has(ch) && y <= LEAF_ROWS });
      x += w;
    }
  });
  return out;
}

const RUNS = runs();

export function PixelTomato({
  size = 32,
  className,
  title = "Team Tomate HQ",
  decorative = false,
  stage = 3,
}: {
  /** Use a multiple of 16 for perfectly square pixels. */
  size?: number;
  className?: string;
  title?: string;
  decorative?: boolean;
  /** Ripeness, 0 (green) to 3 (ripe, the logo). See `ripenessStage`. */
  stage?: number;
}) {
  const fruit = FRUIT_STAGES[Math.max(0, Math.min(3, Math.round(stage)))];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative || undefined}
    >
      <g className="tomato-fruit">
        {RUNS.filter((r) => !r.leaf).map((r) => (
          <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={fruit[r.ch] ?? r.fill} />
        ))}
      </g>
      <g className="tomato-leaves">
        {RUNS.filter((r) => r.leaf).map((r) => (
          <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
        ))}
      </g>
    </svg>
  );
}
