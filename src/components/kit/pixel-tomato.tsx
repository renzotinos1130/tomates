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

/** Rows 0–5 are the stem and leaves, the rest is the fruit. */
const LEAF_ROWS = 6;
const LEAF_CHARS = new Set(["g", "e", "y", "s"]);

interface Run {
  x: number;
  y: number;
  w: number;
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
      out.push({ x, y, w, fill: TOMATO_PALETTE[ch], leaf: LEAF_CHARS.has(ch) && y <= LEAF_ROWS });
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
}: {
  /** Use a multiple of 16 for perfectly square pixels. */
  size?: number;
  className?: string;
  title?: string;
  decorative?: boolean;
}) {
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
          <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
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
