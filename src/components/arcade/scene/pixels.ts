/**
 * TOMATO TOWER — every texture of the game, drawn here pixel by pixel.
 *
 * Nothing is loaded: each texture is a 16 × 16 (or 8 × 8) grid painted on a
 * small canvas, then shown with nearest-neighbour filtering so that a pixel
 * stays a square at any size. The palette is the app's own (the tomato red,
 * the leaf green, the wood of the farm picture).
 */
import * as THREE from "three";

type Put = (x: number, y: number, color: string) => void;
type Painter = (put: Put, rnd: () => number, size: number) => void;

function sequence(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function paint(size: number, seed: number, painter: Painter): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const put: Put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  painter(put, sequence(seed), size);
  return canvas;
}

export function pixelTexture(source: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(source);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Fills the grid with a base colour, speckled with a few others. */
const speckled = (put: Put, rnd: () => number, size: number, base: string, others: string[], rate: number) => {
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, rnd() < rate ? others[Math.floor(rnd() * others.length)] : base);
};

/** A little tomato, 5 × 5, its top-left corner at (x, y). */
function tomato(put: Put, x: number, y: number) {
  const red = "#d1372a";
  for (let j = 1; j < 5; j++) for (let i = 0; i < 5; i++) if (!((i === 0 || i === 4) && (j === 1 || j === 4))) put(x + i, y + j, red);
  put(x + 1, y + 2, "#f0705c");
  put(x + 3, y + 4, "#a72818");
  put(x + 2, y, "#2e9c5f");
  put(x + 1, y + 1, "#2e9c5f");
  put(x + 2, y + 1, "#237d4b");
  put(x + 3, y + 1, "#2e9c5f");
}

const WOOD = { light: "#c9964f", base: "#b9853f", dark: "#8f6230", line: "#6f4a22" };

const painters = {
  /** The side of a crate: three slats between two posts, a tomato stamped in the middle. */
  crateSide: ((put, rnd, size) => {
    speckled(put, rnd, size, WOOD.base, [WOOD.light, "#ad7a38"], 0.22);
    for (let x = 0; x < size; x++) {
      put(x, 5, WOOD.line);
      put(x, 10, WOOD.line);
      put(x, 0, WOOD.light);
      put(x, 15, WOOD.dark);
    }
    for (let y = 0; y < size; y++) {
      for (const x of [0, 1, 14, 15]) put(x, y, x === 1 || x === 14 ? WOOD.dark : "#7d5529");
    }
    for (const [x, y] of [[1, 2], [14, 2], [1, 13], [14, 13]] as const) put(x, y, "#3f2a14");
    tomato(put, 6, 5);
  }) as Painter,

  /** A crate seen from above: tomatoes to the brim, inside a wooden rim. */
  crateTop: ((put, rnd, size) => {
    speckled(put, rnd, size, "#5b3b1c", ["#6a4622", "#4d3117"], 0.3);
    for (let i = 0; i < size; i++) {
      for (const k of [0, 15]) {
        put(i, k, WOOD.dark);
        put(k, i, WOOD.dark);
      }
      put(i, 1, i > 0 && i < 15 ? WOOD.base : WOOD.dark);
      put(i, 14, i > 0 && i < 15 ? WOOD.base : WOOD.dark);
      put(1, i, i > 0 && i < 15 ? WOOD.base : WOOD.dark);
      put(14, i, i > 0 && i < 15 ? WOOD.base : WOOD.dark);
    }
    for (const [x, y] of [[2, 2], [8, 2], [5, 6], [2, 9], [9, 9]] as const) tomato(put, x, y);
    for (const [x, y] of [[11, 6], [7, 12]] as const) {
      put(x, y, "#d1372a");
      put(x + 1, y, "#d1372a");
      put(x, y + 1, "#a72818");
      put(x + 1, y + 1, "#d1372a");
    }
  }) as Painter,

  crateBottom: ((put, rnd, size) => {
    speckled(put, rnd, size, "#9a6c33", [WOOD.dark, "#a9783a"], 0.25);
    for (let y = 0; y < size; y++) for (const x of [3, 7, 11]) put(x, y, WOOD.line);
  }) as Painter,

  grassTop: ((put, rnd, size) => {
    speckled(put, rnd, size, "#6fae3d", ["#7dbf47", "#5e9a33", "#66a538"], 0.42);
    if (rnd() < 0.5) put(Math.floor(rnd() * size), Math.floor(rnd() * size), "#f4d35e");
    if (rnd() < 0.35) put(Math.floor(rnd() * size), Math.floor(rnd() * size), "#f7f3e8");
  }) as Painter,

  grassSide: ((put, rnd, size) => {
    speckled(put, rnd, size, "#8a5a2b", ["#7a4d24", "#996634", "#6f4520"], 0.35);
    for (let x = 0; x < size; x++) {
      const depth = 2 + Math.floor(rnd() * 3);
      for (let y = 0; y < depth; y++) put(x, y, y === depth - 1 ? "#5e9a33" : "#6fae3d");
    }
  }) as Painter,

  /** Tilled soil: furrows. */
  soil: ((put, rnd, size) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, x % 4 === 0 ? "#5c391b" : rnd() < 0.25 ? "#7d4f26" : "#6f4520");
  }) as Painter,

  path: ((put, rnd, size) => {
    speckled(put, rnd, size, "#c9a86a", ["#b89658", "#d6b87c", "#a98749"], 0.4);
  }) as Painter,

  plank: ((put, rnd, size) => {
    speckled(put, rnd, size, "#a87a3c", ["#b88848", "#986c33"], 0.25);
    for (let y = 0; y < size; y++) for (const x of [0, 5, 10, 15]) put(x, y, "#6f4a22");
  }) as Painter,

  barn: ((put, rnd, size) => {
    speckled(put, rnd, size, "#b23a2e", ["#a23226", "#c0463a"], 0.3);
    for (let y = 0; y < size; y++) for (const x of [0, 4, 8, 12]) put(x, y, "#86271d");
  }) as Painter,

  trim: ((put, rnd, size) => {
    speckled(put, rnd, size, "#f1ece0", ["#e2dccd", "#fbf8f0"], 0.3);
  }) as Painter,

  roof: ((put, rnd, size) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const row = Math.floor(y / 4);
        const edge = y % 4 === 3 || (x + row * 2) % 4 === 0;
        put(x, y, edge ? "#3b2f2a" : rnd() < 0.25 ? "#5a4a41" : "#4d3f37");
      }
  }) as Painter,

  stone: ((put, rnd, size) => {
    speckled(put, rnd, size, "#8e9299", ["#7d8188", "#9da1a8", "#868a91"], 0.45);
    for (let x = 0; x < size; x++) {
      put(x, 7, "#666a71");
      if (x % 8 === 3) for (let y = 0; y < 7; y++) put(x, y, "#666a71");
      if (x % 8 === 7) for (let y = 8; y < 16; y++) put(x, y, "#666a71");
    }
  }) as Painter,

  /** A tomato plant: leaves, and what is ripe. */
  bush: ((put, rnd, size) => {
    speckled(put, rnd, size, "#3f8f3a", ["#4da647", "#327a30", "#58b351"], 0.5);
    for (let i = 0; i < 5; i++) {
      const x = 1 + Math.floor(rnd() * (size - 3));
      const y = 1 + Math.floor(rnd() * (size - 3));
      put(x, y, "#d1372a");
      put(x + 1, y, "#e2553f");
      put(x, y + 1, "#a72818");
      put(x + 1, y + 1, "#d1372a");
    }
  }) as Painter,

  leaves: ((put, rnd, size) => {
    speckled(put, rnd, size, "#3b8a3c", ["#4a9e49", "#2f7432", "#56ac52"], 0.55);
  }) as Painter,

  trunk: ((put, rnd, size) => {
    speckled(put, rnd, size, "#6b4423", ["#5a381c", "#7a502b"], 0.35);
    for (let y = 0; y < size; y++) for (const x of [3, 9, 13]) if (rnd() < 0.7) put(x, y, "#4a2e16");
  }) as Painter,

  hay: ((put, rnd, size) => {
    speckled(put, rnd, size, "#e2b84a", ["#d2a63a", "#f0cb62", "#c59a31"], 0.5);
    for (let x = 0; x < size; x++) for (const y of [4, 11]) put(x, y, "#a8801f");
  }) as Painter,

  cloud: ((put, rnd, size) => {
    speckled(put, rnd, size, "#ffffff", ["#f3f8fc"], 0.2);
    for (let x = 0; x < size; x++) for (let y = 12; y < 16; y++) put(x, y, y > 13 ? "#d4e3f0" : "#e6f0f8");
  }) as Painter,

  sail: ((put, rnd, size) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, x % 4 === 0 || y % 4 === 0 ? "#8f6230" : "#f1ece0");
  }) as Painter,

  gold: ((put, rnd, size) => {
    speckled(put, rnd, size, "#f4b331", ["#f9c653", "#e89b17", "#fcdb8b"], 0.45);
  }) as Painter,

  lantern: ((put, rnd, size) => {
    speckled(put, rnd, size, "#f9c653", ["#fcdb8b", "#f4b331"], 0.4);
    for (let i = 0; i < size; i++) for (const k of [0, 15]) {
      put(i, k, "#3b2f2a");
      put(k, i, "#3b2f2a");
    }
  }) as Painter,
};

export type PixelName = keyof typeof painters;

/** The game's textures, made once for a scene and thrown away with it. */
export class Pixels {
  private made = new Map<string, THREE.CanvasTexture>();

  get(name: PixelName, repeat?: [number, number]): THREE.CanvasTexture {
    const id = repeat ? `${name}:${repeat[0]}x${repeat[1]}` : name;
    let texture = this.made.get(id);
    if (!texture) {
      texture = pixelTexture(paint(16, name.length * 7919 + name.charCodeAt(0), painters[name]));
      if (repeat) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat[0], repeat[1]);
      }
      this.made.set(id, texture);
    }
    return texture;
  }

  /** Any other painting (a face, a crate with someone's face on it), kept under a name. */
  custom(id: string, make: () => HTMLCanvasElement): THREE.CanvasTexture {
    let texture = this.made.get(id);
    if (!texture) {
      texture = pixelTexture(make());
      this.made.set(id, texture);
    }
    return texture;
  }

  /**
   * The three faces of a crate side by side (side, top, bottom) in one picture,
   * so that a whole tower is one material. `stamp` paints over the side: the
   * face of whoever placed the crate, on the shared tower.
   */
  crateAtlas(id: string, stamp?: (put: Put) => void): THREE.CanvasTexture {
    return this.custom(`atlas:${id}`, () => {
      const atlas = document.createElement("canvas");
      atlas.width = 48;
      atlas.height = 16;
      const ctx = atlas.getContext("2d")!;
      const side = paint(16, 101, (put, rnd, size) => {
        painters.crateSide(put, rnd, size);
        if (stamp) {
          // The stamp takes the place of the tomato, on a plate of lighter wood.
          for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) put(x, y, y === 3 || y === 12 || x === 3 || x === 12 ? WOOD.dark : WOOD.light);
          stamp((x, y, color) => put(x + 4, y + 4, color));
        }
      });
      ctx.drawImage(side, 0, 0);
      ctx.drawImage(paint(16, 202, painters.crateTop), 16, 0);
      ctx.drawImage(paint(16, 303, painters.crateBottom), 32, 0);
      return atlas;
    });
  }

  dispose() {
    for (const texture of this.made.values()) texture.dispose();
    this.made.clear();
  }
}

/**
 * A unit box whose faces read the crate atlas: sides from the first third, the
 * top from the second, the bottom from the third. Texels are inset by a hair
 * so that neighbours never bleed into one another.
 */
export function crateGeometry(): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  // Faces come in the order +x, −x, +y, −y, +z, −z, four corners each.
  const tile = [0, 0, 1, 2, 0, 0];
  const inset = 0.004;
  for (let face = 0; face < 6; face++) {
    for (let corner = 0; corner < 4; corner++) {
      const i = face * 4 + corner;
      const u = uv.getX(i);
      const from = tile[face] / 3 + inset;
      const to = (tile[face] + 1) / 3 - inset;
      uv.setX(i, from + (to - from) * u);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}
