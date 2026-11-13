#!/usr/bin/env node
/**
 * Builds src/components/kit/icons.tsx from the Nova icon set.
 *
 *   design/nova-icons.svg         the set, as exported from Figma (one frame, 24 px icons on a
 *                                 56 px grid, every icon in a group named « icon_line/<name> »)
 *   design/icons-complements.svg  the few glyphs Nova does not have, drawn in its grammar
 *   design/icons.json             which glyph each icon of the app uses
 *
 * Nothing is redrawn here: the path data is copied as exported, only moved from its place in
 * the frame to the 24 × 24 box of an icon. Black becomes currentColor, and the 2 px stroke of
 * the set becomes the default of a `strokeWidth` prop.
 *
 *   node scripts/build-icons.mjs            writes the module
 *   node scripts/build-icons.mjs --check    fails if the module on disk is not up to date
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const OUT = "src/components/kit/icons.tsx";
const GRID = { first: 56, step: 56, box: 24 };

/** A tiny reader for the flat SVG Figma writes: nested <g id>, and <path>, <rect>, <circle>. */
function readGroups(svg, prefix) {
  const groups = new Map();
  const stack = [];
  for (const [, closing, tag, rawAttrs, selfClosing] of svg.matchAll(/<(\/)?([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/)?>/g)) {
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    if (closing) {
      if (tag === "g") stack.pop();
      continue;
    }
    if (tag === "g") {
      const named = attrs.id?.startsWith(prefix) ? attrs.id.slice(prefix.length) : null;
      if (named) {
        if (groups.has(named)) throw new Error(`Two glyphs are named « ${named} »`);
        groups.set(named, []);
      }
      if (!selfClosing) stack.push(named);
      continue;
    }
    const owner = stack.findLast((name) => name !== null);
    if (owner && ["path", "rect", "circle"].includes(tag)) groups.get(owner).push({ tag, attrs });
  }
  return groups;
}

const round = (n) => String(Math.round(n * 1000) / 1000);

/** Moves path data by (-dx, -dy). Figma writes absolute M, L, C, H, V and Z only. */
function movePath(d, dx, dy) {
  return d.replace(/([MLCHVZ])([^MLCHVZ]*)/g, (_, command, rest) => {
    const numbers = (rest.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (command === "Z") return "Z";
    const moved =
      command === "H" ? numbers.map((x) => x - dx) : command === "V" ? numbers.map((y) => y - dy) : numbers.map((n, i) => (i % 2 === 0 ? n - dx : n - dy));
    return command + moved.map(round).join(" ");
  });
}

/** Every coordinate an element is drawn with, to find its cell and to check it stays in the box. */
function points({ tag, attrs }) {
  if (tag === "circle") return [[Number(attrs.cx), Number(attrs.cy)]];
  if (tag === "rect") {
    const [x, y] = [Number(attrs.x ?? 0), Number(attrs.y ?? 0)];
    return [[x, y], [x + Number(attrs.width), y + Number(attrs.height)]];
  }
  const out = [];
  let [x, y] = [0, 0];
  for (const [, command, rest] of attrs.d.matchAll(/([MLCHVZ])([^MLCHVZ]*)/g)) {
    const numbers = (rest.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (command === "H") for (const n of numbers) out.push([(x = n), y]);
    else if (command === "V") for (const n of numbers) out.push([x, (y = n)]);
    else for (let i = 0; i + 1 < numbers.length; i += 2) out.push([(x = numbers[i]), (y = numbers[i + 1])]);
  }
  return out;
}

/** One element, moved to the icon's own box, in the colours of the text around it. */
function normalise(el, dx, dy) {
  const a = el.attrs;
  const out = {};
  if (el.tag === "path") out.d = movePath(a.d, dx, dy);
  if (el.tag === "circle") Object.assign(out, { cx: round(a.cx - dx), cy: round(a.cy - dy), r: a.r });
  if (el.tag === "rect") {
    Object.assign(out, { x: round(Number(a.x ?? 0) - dx), y: round(Number(a.y ?? 0) - dy), width: a.width, height: a.height });
    if (a.rx) out.rx = a.rx;
  }
  if (a["fill-rule"]) out.fillRule = a["fill-rule"];
  if (a["clip-rule"]) out.clipRule = a["clip-rule"];
  // The set is drawn in black: a 2 px stroke (the default of the icon), or a filled shape.
  if (a.fill && a.fill !== "none") out.fill = "currentColor";
  if (!a.stroke) out.stroke = "none";
  else if (a["stroke-width"] && a["stroke-width"] !== "2") out.strokeWidth = a["stroke-width"];
  return [el.tag, out];
}

function glyphs(svg, prefix, { onGrid }) {
  const out = new Map();
  for (const [name, elements] of readGroups(svg, prefix)) {
    if (elements.length === 0) continue;
    let [dx, dy] = [0, 0];
    if (onGrid) {
      const [px, py] = points(elements[0])[0];
      const cell = (v) => GRID.first + Math.round((v - GRID.first - GRID.box / 2) / GRID.step) * GRID.step;
      [dx, dy] = [cell(px), cell(py)];
    }
    const node = elements.map((el) => normalise(el, dx, dy));
    // A glyph that leaves its box was put in the wrong cell: better to stop than to draw it cut.
    for (const el of elements)
      for (const [x, y] of points(el))
        if (x - dx < -0.5 || x - dx > GRID.box + 0.5 || y - dy < -0.5 || y - dy > GRID.box + 0.5)
          throw new Error(`« ${name} » is drawn outside its 24 px box (${round(x - dx)}, ${round(y - dy)})`);
    out.set(name, node);
  }
  return out;
}

const nova = glyphs(read("design/nova-icons.svg"), "icon_line/", { onGrid: true });
const extra = glyphs(read("design/icons-complements.svg"), "complement/", { onGrid: false });
const map = JSON.parse(read("design/icons.json"));

const lines = [];
const used = new Set();
for (const [name, spec] of Object.entries(map.icons)) {
  const { glyph, transform, note } = typeof spec === "string" ? { glyph: spec } : spec;
  const own = glyph.startsWith("+");
  const node = own ? extra.get(glyph.slice(1)) : nova.get(glyph);
  if (!node) throw new Error(`${name}: no glyph named « ${glyph} » in ${own ? "the complements" : "Nova"}`);
  used.add(glyph);
  const source = own ? `complement « ${glyph.slice(1)} » (Nova has none)` : `Nova « ${glyph} »${transform ? `, ${note ?? transform}` : ""}`;
  lines.push(`/** ${source} */`);
  lines.push(`export const ${name} = icon(${JSON.stringify(name)}, ${JSON.stringify(node)}${transform ? `, ${JSON.stringify(transform)}` : ""});`);
}
for (const [alias, target] of Object.entries(map.aliases ?? {})) {
  if (!map.icons[target]) throw new Error(`Alias ${alias}: no icon named ${target}`);
  lines.push(`export const ${alias} = ${target};`);
}
for (const name of extra.keys()) if (!used.has(`+${name}`)) throw new Error(`The complement « ${name} » is not used by any icon`);

const source = `// GENERATED by scripts/build-icons.mjs from design/ — do not edit by hand.
// To change an icon: edit design/icons.json (or the SVG files beside it), then \`npm run icons\`.
//
// The names are the ones the app has always given its icons (they say what an icon is for);
// the drawings are the Nova icon set: 24 px, 2 px strokes with round ends.
// ${nova.size} glyphs in the set, ${Object.keys(map.icons).length} icons here.
import { icon } from "./icon";

export type { Icon as IconType, IconProps } from "./icon";

${lines.join("\n")}
`;

if (process.argv.includes("--check")) {
  if (read(OUT) !== source) {
    console.error(`${OUT} is not up to date: run \`npm run icons\`.`);
    process.exit(1);
  }
  console.log(`${OUT} is up to date.`);
} else {
  writeFileSync(path.join(root, OUT), source);
  console.log(`${OUT}: ${Object.keys(map.icons).length} icons (${[...used].filter((g) => g.startsWith("+")).length} complements), ${Object.keys(map.aliases ?? {}).length} aliases.`);
}
