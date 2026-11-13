/**
 * TOMATO TOWER — the team, as little characters made of blocks.
 *
 * Each partner is drawn for the game from their portrait in the app: the same
 * hair, beard and clothes, as a head with an 8 × 8 face and a body of a few
 * boxes. Someone without a portrait gets a plain character in their own colour.
 */
import * as THREE from "three";
import { portraitName } from "@/lib/avatars";
import type { Member, MemberColor } from "@/lib/types";
import { paint, type Pixels } from "./pixels";

type HairStyle = "bun" | "short" | "beanie" | "sides" | "tall" | "long" | "plain";

export interface Look {
  skin: string;
  hair: string;
  style: HairStyle;
  beard: string | null;
  top: string;
  /** A second colour on the chest (a t-shirt under a jacket, a collar). */
  accent: string | null;
  legs: string;
}

const SKIN = "#e9b58c";
const LOOKS: Record<string, Look> = {
  "alexandre halle": { skin: SKIN, hair: "#4a2c1a", style: "bun", beard: "#3f2718", top: "#a39c8f", accent: null, legs: "#3a3f4a" },
  "antoine favreau": { skin: "#e6ae84", hair: "#2b1a12", style: "short", beard: "#2b1a12", top: "#1e1e22", accent: null, legs: "#2a2c33" },
  "dominic renzetti": { skin: SKIN, hair: "#1f1f22", style: "beanie", beard: "#3f2718", top: "#1e1e22", accent: "#e8e4da", legs: "#2a2c33" },
  "jimmy perreault": { skin: "#ecbb93", hair: "#4a2c1a", style: "sides", beard: "#9a9a9a", top: "#1e1e22", accent: null, legs: "#34363d" },
  "marco drouin": { skin: SKIN, hair: "#9a5a2c", style: "tall", beard: "#8a5a34", top: "#1f2a4a", accent: "#c9a227", legs: "#2f3542" },
  "maya martel": { skin: "#e8b089", hair: "#3a2218", style: "long", beard: null, top: "#f2efe9", accent: "#7a1f2b", legs: "#2a2c33" },
};

/** The app's member colours, as the colour of a sweater. */
const SWEATER: Record<MemberColor, string> = {
  teal: "#12948c",
  amber: "#e89b17",
  indigo: "#4f6391",
  rose: "#d45a7a",
  sky: "#3d9bd4",
  violet: "#7d5fc4",
  emerald: "#2e9c5f",
  orange: "#e2763f",
  slate: "#64707f",
};

export function lookFor(member: Pick<Member, "full_name" | "color">): Look {
  const who = portraitName(member);
  return (who && LOOKS[who]) || { skin: SKIN, hair: "#3a2a20", style: "plain", beard: null, top: SWEATER[member.color] ?? "#64707f", accent: null, legs: "#2f3542" };
}

/** Darker, for the shaded faces of a block. */
function shade(hex: string, by: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.max(0, Math.min(255, Math.round(c * by)));
  const r = channel(n >> 16);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

type Put = (x: number, y: number, color: string) => void;

/** A face, 8 × 8, looking at us: eyes, brows, a smile, and whatever hair and beard the look has. */
export function paintFace(put: Put, look: Look) {
  const hairRows = look.style === "beanie" ? 3 : look.style === "tall" || look.style === "bun" ? 2 : look.style === "plain" || look.style === "short" ? 2 : 2;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) put(x, y, look.skin);
  for (let y = 0; y < hairRows; y++) for (let x = 0; x < 8; x++) put(x, y, look.hair);
  if (look.style === "beanie") for (let x = 0; x < 8; x++) put(x, 2, shade(look.hair, 1.6));
  if (look.style === "long") for (let y = 2; y < 8; y++) for (const x of [0, 7]) put(x, y, look.hair);
  if (look.style === "sides") for (const x of [0, 7]) put(x, 2, "#9a9a9a");
  // Brows and eyes.
  const brow = shade(look.hair, 0.8);
  for (const x of [1, 2, 5, 6]) put(x, 3, brow);
  put(1, 4, "#ffffff");
  put(2, 4, "#1c1c1f");
  put(5, 4, "#1c1c1f");
  put(6, 4, "#ffffff");
  put(3, 5, shade(look.skin, 0.88));
  put(4, 5, shade(look.skin, 0.88));
  if (look.beard) {
    for (let x = 0; x < 8; x++) {
      put(x, 7, look.beard);
      if (x < 2 || x > 5) put(x, 6, look.beard);
      if (x === 0 || x === 7) put(x, 5, look.beard);
    }
    for (const x of [2, 5]) put(x, 6, look.beard);
  }
  // The smile.
  for (const x of [3, 4]) put(x, 6, "#ffffff");
  if (!look.beard) {
    put(2, 6, "#b7604f");
    put(5, 6, "#b7604f");
  }
}

function faceTexture(pixels: Pixels, id: string, look: Look) {
  return pixels.custom(`face:${id}`, () => paint(8, 1, (put) => paintFace(put, look)));
}

const flat = (color: string) => new THREE.MeshLambertMaterial({ color });

export type Mood = "idle" | "walk" | "hop" | "cheer" | "flop";

export interface Character {
  group: THREE.Group;
  /** Sets what the character is doing; `hop`, `cheer` and `flop` play once and return to idle. */
  play(mood: Mood, seconds?: number): void;
  setCrown(on: boolean): void;
  update(dt: number): void;
  readonly mood: Mood;
}

/**
 * A character about one and a half crates tall, standing on y = 0, looking
 * towards +z. Squat on purpose: a large head, short legs.
 */
export function buildCharacter(pixels: Pixels, id: string, look: Look, materials: THREE.Material[], geometries: THREE.BufferGeometry[]): Character {
  // `group` is placed and turned by the scene; `rig`, inside it, is what the moods move.
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const box = (w: number, h: number, d: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geometries.push(g);
    return g;
  };
  const mat = (color: string) => {
    const m = flat(color);
    materials.push(m);
    return m;
  };
  const skin = mat(look.skin);
  const hair = mat(look.hair);
  const top = mat(look.top);
  const legsMat = mat(look.legs);
  const shoes = mat("#f1ece0");

  // Legs, each hinged at the hip.
  const legGeometry = box(0.2, 0.34, 0.22);
  const leg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.34, 0);
    const m = new THREE.Mesh(legGeometry, legsMat);
    m.position.y = -0.17;
    const shoe = new THREE.Mesh(box(0.22, 0.08, 0.28), shoes);
    shoe.position.set(0, -0.31, 0.03);
    pivot.add(m, shoe);
    rig.add(pivot);
    return pivot;
  };
  const legL = leg(-0.13);
  const legR = leg(0.13);

  const body = new THREE.Mesh(box(0.52, 0.5, 0.3), top);
  body.position.y = 0.59;
  rig.add(body);
  if (look.accent) {
    const accent = new THREE.Mesh(box(0.2, 0.3, 0.02), mat(look.accent));
    accent.position.set(0, 0.66, 0.155);
    rig.add(accent);
  }

  // Arms, hinged at the shoulder.
  const armGeometry = box(0.15, 0.44, 0.16);
  const arm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.8, 0);
    const sleeve = new THREE.Mesh(armGeometry, top);
    sleeve.position.y = -0.2;
    const hand = new THREE.Mesh(box(0.14, 0.1, 0.15), skin);
    hand.position.y = -0.46;
    pivot.add(sleeve, hand);
    rig.add(pivot);
    return pivot;
  };
  const armL = arm(-0.34);
  const armR = arm(0.34);

  // The head: the face on the front, hair on top and behind.
  const head = new THREE.Group();
  head.position.y = 1.16;
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(pixels, id, look) });
  materials.push(faceMat);
  const side = look.style === "long" || look.style === "beanie" ? hair : skin;
  // +x, −x, +y, −y, +z (front), −z (back)
  const skull = new THREE.Mesh(box(0.62, 0.62, 0.6), [side, side, hair, skin, faceMat, hair]);
  head.add(skull);
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const m = new THREE.Mesh(box(w, h, d), material);
    m.position.set(x, y, z);
    head.add(m);
  };
  if (look.style === "bun") add(0.26, 0.24, 0.26, 0, 0.38, -0.22, hair);
  if (look.style === "tall") add(0.56, 0.16, 0.5, 0, 0.38, 0, hair);
  if (look.style === "short" || look.style === "plain" || look.style === "sides") add(0.64, 0.1, 0.62, 0, 0.3, -0.01, hair);
  if (look.style === "sides") {
    add(0.04, 0.2, 0.4, -0.32, 0.08, -0.06, mat("#9a9a9a"));
    add(0.04, 0.2, 0.4, 0.32, 0.08, -0.06, mat("#9a9a9a"));
  }
  if (look.style === "beanie") {
    add(0.68, 0.3, 0.66, 0, 0.2, 0, hair);
    add(0.7, 0.1, 0.68, 0, 0.07, 0, mat(shade(look.hair, 1.6)));
  }
  if (look.style === "long") {
    add(0.66, 0.74, 0.16, 0, -0.14, -0.32, hair);
    add(0.1, 0.5, 0.3, -0.34, -0.18, -0.1, hair);
    add(0.1, 0.5, 0.3, 0.34, -0.18, -0.1, hair);
    add(0.06, 0.08, 0.06, 0.34, -0.12, 0.12, mat("#e0b020"));
  }
  rig.add(head);

  // The crown of the week's champion: a band and three points, each with a little tomato.
  const crown = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ map: pixels.get("gold"), emissive: new THREE.Color("#5a3a00") });
  materials.push(gold);
  const tomatoMat = mat("#d1372a");
  const band = new THREE.Mesh(box(0.56, 0.1, 0.54), gold);
  crown.add(band);
  for (const x of [-0.2, 0, 0.2]) {
    const point = new THREE.Mesh(box(0.12, 0.14, 0.12), gold);
    point.position.set(x, 0.12, 0.2);
    const jewel = new THREE.Mesh(box(0.08, 0.08, 0.08), tomatoMat);
    jewel.position.set(x, 0.22, 0.2);
    crown.add(point, jewel);
  }
  crown.position.y = look.style === "tall" ? 0.5 : look.style === "beanie" ? 0.4 : 0.4;
  crown.visible = false;
  head.add(crown);

  let mood: Mood = "idle";
  let clock = Math.random() * 10;
  let left = 0;

  return {
    group,
    get mood() {
      return mood;
    },
    play(next, seconds) {
      mood = next;
      clock = next === "idle" || next === "walk" ? clock : 0;
      left = seconds ?? (next === "hop" ? 0.45 : next === "cheer" ? 2.4 : next === "flop" ? 2.6 : Infinity);
    },
    setCrown(on) {
      crown.visible = on;
    },
    update(dt) {
      clock += dt;
      if (mood !== "idle" && mood !== "walk") {
        left -= dt;
        if (left <= 0) mood = "idle";
      }
      // Rest pose, then what the mood adds to it.
      let y = 0;
      let lean = 0;
      let swingLegs = 0;
      let armsUp = 0;
      let armSwing = 0;
      let nod = Math.sin(clock * 1.7) * 0.04;
      let spin = 0;
      if (mood === "idle") {
        y = Math.abs(Math.sin(clock * 2.2)) * 0.015;
        armSwing = Math.sin(clock * 2.2) * 0.06;
      } else if (mood === "walk") {
        swingLegs = Math.sin(clock * 9) * 0.6;
        armSwing = -swingLegs * 0.8;
        y = Math.abs(Math.sin(clock * 9)) * 0.04;
      } else if (mood === "hop") {
        const t = Math.min(1, clock / 0.45);
        y = Math.sin(t * Math.PI) * 0.5;
        armsUp = Math.sin(t * Math.PI) * 2.4;
      } else if (mood === "cheer") {
        const beat = clock * 2.6;
        y = Math.abs(Math.sin(beat * Math.PI)) * 0.55;
        armsUp = 2.7 + Math.sin(clock * 18) * 0.25;
        spin = clock * 5;
        nod = -0.2;
      } else if (mood === "flop") {
        // Falls on its back, lies there a moment, sits up shaking its head.
        const down = Math.min(1, clock / 0.35);
        const up = Math.max(0, Math.min(1, (clock - 1.7) / 0.6));
        lean = -(Math.PI / 2) * (down * down) * (1 - up);
        y = 0.28 * Math.sin(Math.min(1, clock / 0.35) * Math.PI) * 0.6;
        armsUp = 1.4 * down * (1 - up);
        nod = up > 0 && up < 1 ? Math.sin(clock * 22) * 0.25 : 0;
      }
      rig.position.y = y;
      rig.rotation.x = lean;
      rig.rotation.y = spin;
      legL.rotation.x = swingLegs;
      legR.rotation.x = -swingLegs;
      armL.rotation.x = armSwing - armsUp;
      armR.rotation.x = -armSwing - armsUp;
      armL.rotation.z = -armsUp * 0.12;
      armR.rotation.z = armsUp * 0.12;
      head.rotation.x = nod;
    },
  };
}
