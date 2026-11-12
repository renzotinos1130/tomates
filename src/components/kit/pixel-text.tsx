import { cn } from "@/lib/utils";

/**
 * Team Tomate's lettering: a 5×7 bitmap alphabet drawn pixel by pixel, the
 * typographic sibling of the pixel tomato. Each glyph is seven rows of five
 * bits (most significant bit = left pixel).
 */
const GLYPHS: Record<string, readonly number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const LETTER_GAP = 1;
const SPACE_W = 3;

interface Run {
  x: number;
  y: number;
  w: number;
}

/** Lays the text out on the pixel grid, merging neighbours into horizontal runs. */
function layout(text: string): { runs: Run[]; width: number } {
  const runs: Run[] = [];
  let cursor = 0;
  // The alphabet has no accents: "É" is drawn as "E" rather than left blank.
  for (const ch of text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cursor += SPACE_W;
      continue;
    }
    glyph.forEach((row, y) => {
      let x = 0;
      while (x < GLYPH_W) {
        if (!(row & (1 << (GLYPH_W - 1 - x)))) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < GLYPH_W && row & (1 << (GLYPH_W - 1 - x - w))) w++;
        runs.push({ x: cursor + x, y, w });
        x += w;
      }
    });
    cursor += GLYPH_W + LETTER_GAP;
  }
  return { runs, width: Math.max(0, cursor - LETTER_GAP) };
}

/**
 * Text set in the pixel alphabet. `unit` is the size of one pixel in CSS
 * pixels (keep it whole so every pixel stays square). Colour follows
 * `currentColor`; `shadow` adds the blocky one-pixel drop of game lettering.
 */
export function PixelText({
  text,
  unit = 2,
  shadow,
  className,
  decorative = false,
}: {
  text: string;
  unit?: number;
  /** CSS colour of the one-pixel drop shadow. */
  shadow?: string;
  className?: string;
  /** Hide from assistive tech when real text sits next to it. */
  decorative?: boolean;
}) {
  const { runs, width } = layout(text);
  const pad = shadow ? 1 : 0;
  return (
    <svg
      width={(width + pad) * unit}
      height={(GLYPH_H + pad) * unit}
      viewBox={`0 0 ${width + pad} ${GLYPH_H + pad}`}
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative || undefined}
    >
      {shadow && (
        <g fill={shadow}>
          {runs.map((r) => (
            <rect key={`s${r.x}-${r.y}`} x={r.x + 1} y={r.y + 1} width={r.w} height={1} />
          ))}
        </g>
      )}
      <g fill="currentColor">
        {runs.map((r) => (
          <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
        ))}
      </g>
    </svg>
  );
}
