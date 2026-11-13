/**
 * TOMATO TOWER — the scene: what is drawn, and how it moves.
 *
 * One WebGL renderer for the whole arcade: the farm, the tower, the crate that
 * swings, what falls, the square particles, the team's characters and the
 * camera that follows the top of the tower and steps back as it grows. The
 * rules are not here (see lib/tower/engine.ts): the scene is told what
 * happened and shows it.
 */
import * as THREE from "three";
import type { Rect } from "@/lib/tower/engine";
import { buildCharacter, paintFace, type Character, type Look } from "./cast";
import { crateGeometry, Pixels } from "./pixels";
import { BASE_Y, buildWorld, type World } from "./world";

/** The height of a crate: wide and shallow, like the ones in the field. */
export const CRATE_H = 0.72;
const CAPACITY = 900;
/** Where the camera stands from what it looks at: an isometric view, a little tilted. */
const CAMERA_DIR = new THREE.Vector3(1, 0.86, 1).normalize();
/** The picture's own axes, in the world: what « to the right » and « up » mean on screen. */
const CAMERA_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const CAMERA_UP = new THREE.Vector3().crossVectors(CAMERA_RIGHT, CAMERA_DIR.clone().negate()).normalize();
const GRAVITY = 26;
/** Where the lift stands: on a diagonal of the tower, which the swinging crate never crosses. */
const LIFT_X = 2.9;
const LIFT_Z = -2.9;
const LIFT_DECK = 0.18;
const MAST_SEGMENTS = 720;

/** A part of the picture, in fractions of its width and height (y from the top). */
export interface FreeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CastMember {
  id: string;
  name: string;
  look: Look;
}

export type SceneView = "lobby" | "play" | "over" | "board" | "team";

export interface Landing {
  kind: "perfect" | "cut" | "miss";
  released: Rect;
  placed: Rect | null;
  fallen: Rect | null;
}

const LIGHTS = [
  { ambient: "#ffffff", ambientPower: 1.05, sun: "#fff1d6", sunPower: 1.5, evening: 0 },
  { ambient: "#ffffff", ambientPower: 1.15, sun: "#ffffff", sunPower: 1.65, evening: 0 },
  { ambient: "#ffd9b8", ambientPower: 0.95, sun: "#ff9a5a", sunPower: 1.35, evening: 0.55 },
  { ambient: "#8d9bd0", ambientPower: 0.78, sun: "#9db4ff", sunPower: 0.6, evening: 1 },
  { ambient: "#b9aaff", ambientPower: 0.88, sun: "#d8c8ff", sunPower: 0.85, evening: 1 },
];

const centre = (r: Rect) => ({ x: (r.x0 + r.x1) / 2000, z: (r.z0 + r.z1) / 2000, w: (r.x1 - r.x0) / 1000, d: (r.z1 - r.z0) / 1000 });
const floorY = (floor: number) => BASE_Y + (floor - 0.5) * CRATE_H;

interface Piece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  alive: boolean;
}

interface Walker {
  id: string;
  character: Character;
  path: [number, number][];
  leg: number;
  wait: number;
  speed: number;
  /** Kept still on a podium block while the board is on show. */
  parked: boolean;
}

export class TowerScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private pixels = new Pixels();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private world: World;
  private ambient = new THREE.AmbientLight("#ffffff", 1);
  private sun = new THREE.DirectionalLight("#fff1d6", 1.4);
  private light = { ...LIGHTS[0] };
  private lightGoal = LIGHTS[0];

  private crate = crateGeometry();
  private stacks = new Map<string, THREE.InstancedMesh>();
  private atlases = new Map<string, THREE.MeshLambertMaterial>();
  private moving: THREE.Mesh;
  private pieces: Piece[] = [];
  private squash: { mesh: THREE.InstancedMesh; index: number; rect: Rect; floor: number; t: number }[] = [];
  private ring: THREE.LineSegments;
  private ringLife = 0;
  private ringBase = new THREE.Vector3(1, 1, 1);

  private sparks: THREE.InstancedMesh;
  private sparkData: { p: THREE.Vector3; v: THREE.Vector3; life: number; span: number; size: number }[] = [];
  private nextSpark = 0;

  private cast = new Map<string, Walker>();
  private looks = new Map<string, Look>();
  private meId: string | null = null;
  private podium: THREE.Group;
  /** The player's own character rides a lift that climbs with the tower: it stays in the picture. */
  private lift = new THREE.Group();
  private mast: THREE.InstancedMesh;
  private liftY = 0;
  private mastDrawn = -1;

  private view: SceneView = "lobby";
  private floors = 0;
  private target = new THREE.Vector3(0, 3, 0);
  private goal = new THREE.Vector3(0, 3, 0);
  private viewH = 15;
  private viewGoal = 15;
  /** The part of the picture nothing is laid over, and where that puts the subject (in world units, from the centre). */
  private free: FreeArea = { x: 0, y: 0, w: 1, h: 1 };
  private shift = new THREE.Vector2();
  private shiftGoal = new THREE.Vector2();
  private eye = new THREE.Vector3();
  private shake = 0;
  private time = 0;
  private aspect = 1;
  private calm: boolean;
  private matrix = new THREE.Matrix4();
  private disposed = false;

  constructor(host: HTMLElement, options: { calm: boolean }) {
    this.calm = options.calm;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    host.appendChild(this.canvas);

    this.sun.position.set(-6, 14, 9);
    this.scene.add(this.ambient, this.sun);
    this.world = buildWorld(this.pixels, this.geometries, this.materials);
    this.scene.add(this.world.group);

    // The crate that swings, and the pieces that fall: a small pool, reused.
    this.moving = new THREE.Mesh(this.crate, this.atlas("plain"));
    this.moving.visible = false;
    this.scene.add(this.moving);
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(this.crate, this.atlas("plain"));
      mesh.visible = false;
      this.scene.add(mesh);
      this.pieces.push({ mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), alive: false });
    }

    // The white outline that opens around a « parfait ».
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const lineMat = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 });
    this.geometries.push(edges);
    this.materials.push(lineMat);
    this.ring = new THREE.LineSegments(edges, lineMat);
    this.ring.visible = false;
    this.scene.add(this.ring);

    // Square particles.
    const bit = new THREE.BoxGeometry(1, 1, 1);
    const bitMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    this.geometries.push(bit);
    this.materials.push(bitMat);
    this.sparks = new THREE.InstancedMesh(bit, bitMat, 200);
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 200; i++) {
      this.sparks.setMatrixAt(i, hidden);
      this.sparks.setColorAt(i, new THREE.Color("#ffffff"));
      this.sparkData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, span: 1, size: 0.1 });
    }
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);

    // The podium of the board: three stacks of crates on the grass, in front and to the left.
    this.podium = new THREE.Group();
    this.podium.position.set(-9, 0, 5);
    this.podium.rotation.y = Math.PI / 4;
    const stand = (x: number, h: number, name: "gold" | "stone" | "plank") => {
      const mat = new THREE.MeshLambertMaterial({ map: this.pixels.get(name) });
      const geo = new THREE.BoxGeometry(1.5, h, 1.5);
      this.materials.push(mat);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, h / 2, 0);
      this.podium.add(mesh);
    };
    stand(0, 1.7, "gold");
    stand(-1.6, 1.15, "stone");
    stand(1.6, 0.75, "plank");
    this.scene.add(this.podium);

    // The lift: a deck of planks on a mast that is built up, block by block, as the tower grows.
    const deckGeo = new THREE.BoxGeometry(1.5, LIFT_DECK, 1.5);
    const deckMat = new THREE.MeshLambertMaterial({ map: this.pixels.get("plank") });
    const mastGeo = new THREE.BoxGeometry(0.46, 1, 0.46);
    const mastMat = new THREE.MeshLambertMaterial({ map: this.pixels.get("trunk") });
    this.geometries.push(deckGeo, mastGeo);
    this.materials.push(deckMat, mastMat);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = LIFT_DECK / 2;
    this.lift.add(deck);
    this.lift.position.set(LIFT_X, 0, LIFT_Z);
    this.mast = new THREE.InstancedMesh(mastGeo, mastMat, MAST_SEGMENTS);
    this.mast.count = 0;
    this.mast.frustumCulled = false;
    this.mast.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.lift, this.mast);

    this.resize();
    this.placeCamera(true);
  }

  /* ------------------------------ materials ------------------------------ */

  /** The crate material of a member (their face stamped on the side), or the plain one. */
  private atlas(id: string): THREE.MeshLambertMaterial {
    let material = this.atlases.get(id);
    if (!material) {
      const look = this.looks.get(id);
      material = new THREE.MeshLambertMaterial({ map: this.pixels.crateAtlas(id, look ? (put) => paintFace(put, look) : undefined) });
      this.atlases.set(id, material);
      this.materials.push(material);
    }
    return material;
  }

  private stack(id: string): THREE.InstancedMesh {
    let mesh = this.stacks.get(id);
    if (!mesh) {
      mesh = new THREE.InstancedMesh(this.crate, this.atlas(id), id === "plain" ? CAPACITY : 260);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.stacks.set(id, mesh);
      this.scene.add(mesh);
    }
    return mesh;
  }

  private crateMatrix(rect: Rect, floor: number, squeeze = 1) {
    const c = centre(rect);
    return this.matrix.makeScale(c.w, CRATE_H * squeeze, c.d).setPosition(c.x, floorY(floor) - (CRATE_H * (1 - squeeze)) / 2, c.z);
  }

  /* --------------------------------- cast -------------------------------- */

  /** Who is in the field. The player's own character stands by the tower; the others walk about. */
  setCast(members: CastMember[], meId: string | null, championId: string | null) {
    this.meId = meId;
    // Rounds that keep clear of the tower, of the rows and of the podium.
    const paths: [number, number][][] = [
      [[-12, 9], [8, 9]],
      [[0.6, 6.5], [0.6, 18]],
      [[-11.5, 11.2], [-3.2, 11.2]],
      [[2.6, 7.9], [15.5, 7.9], [15.5, 11.5], [2.6, 11.5]],
      [[-2.4, 12], [-2.4, 19.8], [-12, 19.8]],
    ];
    const wanted = new Set(members.map((m) => m.id));
    for (const [id, walker] of this.cast) {
      if (!wanted.has(id)) {
        this.scene.remove(walker.character.group);
        this.cast.delete(id);
      }
    }
    let lane = 0;
    for (const member of members) {
      this.looks.set(member.id, member.look);
      let walker = this.cast.get(member.id);
      if (!walker) {
        const character = buildCharacter(this.pixels, member.id, member.look, this.materials, this.geometries);
        this.scene.add(character.group);
        walker = { id: member.id, character, path: [], leg: 0, wait: Math.random() * 2, speed: 0.75 + Math.random() * 0.35, parked: false };
        this.cast.set(member.id, walker);
      }
      walker.character.setCrown(member.id === championId);
      if (member.id === meId) {
        walker.path = [];
        if (!walker.parked) this.standOnLift(walker);
      } else if (walker.path.length === 0) {
        walker.path = paths[lane % paths.length];
        const [x, z] = walker.path[0];
        walker.character.group.position.set(x + (lane >= paths.length ? 1.2 : 0), 0, z);
      }
      if (member.id !== meId) lane += 1;
    }
  }

  /** The player's own character: on the lift, turned towards the tower and a little towards us. */
  private standOnLift(walker: Walker) {
    walker.character.group.position.set(LIFT_X, this.liftY + LIFT_DECK, LIFT_Z);
    walker.character.group.rotation.y = 0.12;
  }

  /** The top three of the board climb the podium; everyone else goes back to the field. */
  setPodium(ids: string[]) {
    const spots: [number, number][] = [[0, 1.7], [-1.6, 1.15], [1.6, 0.75]];
    for (const walker of this.cast.values()) {
      const place = ids.indexOf(walker.id);
      const was = walker.parked;
      walker.parked = place >= 0 && place < 3;
      if (walker.parked) {
        const [x, y] = spots[place];
        const at = new THREE.Vector3(x, y, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).add(this.podium.position);
        walker.character.group.position.copy(at);
        walker.character.group.rotation.y = Math.PI / 4;
        if (place === 0 && !this.calm) walker.character.play("cheer", 3);
        else walker.character.play("idle");
      } else if (was) {
        if (walker.id === this.meId) this.standOnLift(walker);
        else if (walker.path.length) walker.character.group.position.set(walker.path[0][0], 0, walker.path[0][1]);
        walker.character.play("idle");
      }
    }
  }

  /** What the player's own character does about what just happened. */
  react(what: "perfect" | "record" | "miss" | "weekly") {
    const me = this.meId ? this.cast.get(this.meId) : undefined;
    if (!me) return;
    if (what === "perfect") {
      if (me.character.mood === "idle") me.character.play("hop");
    } else if (what === "miss") me.character.play("flop");
    else {
      me.character.play("cheer", what === "weekly" ? 4.2 : 2.4);
      const at = me.character.group.position;
      this.burst(at.x, at.y + 1.6, at.z, what === "weekly" ? 60 : 30, ["#f4b331", "#fcdb8b", "#d1372a", "#ffffff", "#2e9c5f"], 6);
    }
  }

  /* -------------------------------- tower -------------------------------- */

  resetTower() {
    for (const mesh of this.stacks.values()) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const piece of this.pieces) {
      piece.alive = false;
      piece.mesh.visible = false;
    }
    this.squash = [];
    this.floors = 0;
    this.moving.visible = false;
    this.ring.visible = false;
  }

  /** Raises a tower at once, crate by crate (the shared tower, as the team left it). */
  buildTower(crates: { rect: Rect; memberId?: string | null }[]) {
    this.resetTower();
    crates.forEach((c, i) => this.addCrate(c.rect, i + 1, c.memberId ?? null));
    this.floors = crates.length;
  }

  private addCrate(rect: Rect, floor: number, memberId: string | null): { mesh: THREE.InstancedMesh; index: number } | null {
    const mesh = this.stack(memberId && this.looks.has(memberId) ? memberId : "plain");
    if (mesh.count >= mesh.instanceMatrix.count) return null;
    const index = mesh.count;
    mesh.setMatrixAt(index, this.crateMatrix(rect, floor));
    mesh.count = index + 1;
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, index };
  }

  /** Where the swinging crate is right now (null: no crate in the air). `floor` is the one it will become. */
  setMoving(rect: Rect | null, floor: number, memberId: string | null = null) {
    this.moving.visible = !!rect;
    if (!rect) return;
    const c = centre(rect);
    this.moving.material = this.atlas(memberId && this.looks.has(memberId) ? memberId : "plain");
    this.moving.scale.set(c.w, CRATE_H, c.d);
    // It swings a hair above the tower, and comes down when it is let go.
    this.moving.position.set(c.x, floorY(floor) + 0.16, c.z);
  }

  /** A crate was let go: what stays lands, what was cut falls, and the dust flies. */
  land(landing: Landing, floor: number, memberId: string | null = null) {
    this.moving.visible = false;
    const atlasId = memberId && this.looks.has(memberId) ? memberId : "plain";
    if (landing.placed) {
      const added = this.addCrate(landing.placed, floor, memberId);
      this.floors = floor;
      if (added && !this.calm) this.squash.push({ ...added, rect: landing.placed, floor, t: 0 });
      const c = centre(landing.placed);
      const y = floorY(floor) - CRATE_H / 2;
      if (landing.kind === "perfect") {
        this.ring.visible = true;
        this.ring.position.set(c.x, floorY(floor), c.z);
        this.ringBase.set(c.w, CRATE_H, c.d);
        this.ringLife = 1;
        this.shake = this.calm ? 0 : 0.16;
        this.burst(c.x, y + CRATE_H, c.z, 22, ["#fcdb8b", "#ffffff", "#f4b331"], 4.5, c.w, c.d);
      } else {
        this.burst(c.x, y, c.z, 9, ["#c9a86a", "#e6d2a6", "#a98749"], 2.4, c.w, c.d);
      }
    }
    if (landing.fallen) {
      const c = centre(landing.fallen);
      const piece = this.pieces.find((p) => !p.alive) ?? this.pieces[0];
      piece.alive = true;
      piece.mesh.visible = true;
      piece.mesh.material = this.atlas(atlasId);
      piece.mesh.scale.set(Math.max(0.02, c.w), CRATE_H, Math.max(0.02, c.d));
      piece.mesh.position.set(c.x, floorY(floor) + 0.16, c.z);
      piece.mesh.rotation.set(0, 0, 0);
      // It tips away from the tower, on the side it overhung.
      const away = landing.placed ? centre(landing.placed) : { x: 0, z: 0 };
      const dx = c.x - away.x;
      const dz = c.z - away.z;
      const far = Math.hypot(dx, dz) || 1;
      piece.velocity.set((dx / far) * 1.6, landing.kind === "miss" ? -1 : 0.6, (dz / far) * 1.6);
      piece.spin.set((dz / far) * 2.6, 0.4, (-dx / far) * 2.6);
      if (landing.kind === "miss") this.burst(c.x, floorY(floor) - CRATE_H / 2, c.z, 14, ["#d1372a", "#f0705c", "#2e9c5f"], 3.5, c.w, c.d);
    }
  }

  /** The shared tower came down: the base is left bare, and the crates at the top fly off. */
  topple() {
    const crates: { at: THREE.Vector3; scale: THREE.Vector3; mat: THREE.Material }[] = [];
    const quat = new THREE.Quaternion();
    for (const mesh of this.stacks.values()) {
      for (let i = 0; i < mesh.count; i++) {
        const at = new THREE.Vector3();
        const scale = new THREE.Vector3();
        mesh.getMatrixAt(i, this.matrix);
        this.matrix.decompose(at, quat, scale);
        crates.push({ at, scale, mat: mesh.material as THREE.Material });
      }
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.squash = [];
    this.floors = 0;
    // The pool is small: the highest crates are the ones seen falling. A piece already in the air keeps falling.
    const free = this.pieces.filter((p) => !p.alive);
    crates
      .sort((a, b) => b.at.y - a.at.y)
      .slice(0, free.length)
      .forEach((crate, i) => {
        const piece = free[i];
        piece.alive = true;
        piece.mesh.visible = true;
        piece.mesh.material = crate.mat;
        piece.mesh.position.copy(crate.at);
        piece.mesh.scale.copy(crate.scale);
        piece.mesh.rotation.set(0, 0, 0);
        const angle = i * 2.4;
        piece.velocity.set(Math.cos(angle) * 3.2, 4 + (i % 3), Math.sin(angle) * 3.2);
        piece.spin.set(Math.sin(angle) * 4, 1, Math.cos(angle) * 4);
      });
    this.burst(0, BASE_Y + 0.4, 0, 30, ["#d1372a", "#f0705c", "#c9a86a", "#2e9c5f"], 5, 2.4, 2.4);
    this.shake = this.calm ? 0 : 0.5;
  }

  private burst(x: number, y: number, z: number, count: number, colors: string[], power: number, w = 0.4, d = 0.4) {
    if (this.calm) count = Math.min(count, 6);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const index = this.nextSpark;
      this.nextSpark = (this.nextSpark + 1) % this.sparkData.length;
      const s = this.sparkData[index];
      const angle = Math.random() * Math.PI * 2;
      s.p.set(x + (Math.random() - 0.5) * w, y + Math.random() * 0.1, z + (Math.random() - 0.5) * d);
      s.v.set(Math.cos(angle) * power * (0.3 + Math.random() * 0.7), power * (0.5 + Math.random() * 0.9), Math.sin(angle) * power * (0.3 + Math.random() * 0.7));
      s.span = 0.5 + Math.random() * 0.5;
      s.life = s.span;
      s.size = 0.08 + Math.random() * 0.09;
      this.sparks.setColorAt(index, color.set(colors[i % colors.length]));
    }
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
  }

  /* -------------------------------- camera ------------------------------- */

  setView(view: SceneView) {
    this.view = view;
  }

  /** Which part of the sky the tower has reached: the light follows. */
  setZone(zone: number) {
    this.lightGoal = LIGHTS[Math.max(0, Math.min(LIGHTS.length - 1, zone))];
  }

  resize() {
    const host = this.canvas.parentElement;
    if (!host) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.aspect = width / height;
    this.renderer.setSize(width, height, false);
    this.placeCamera(true);
  }

  /** What is laid over the picture leaves this part of it free: the subject is framed there. */
  setFree(free: FreeArea) {
    this.free = free;
  }

  private placeCamera(now: boolean) {
    const top = BASE_Y + this.floors * CRATE_H;
    // What has to fit in the picture: so many units of height, so many of width.
    let tall = 12;
    let wide = 13;
    if (this.view === "lobby") {
      this.goal.set(0, 2.9, 0);
      tall = 10.5;
      wide = 13;
    } else if (this.view === "play") {
      this.goal.set(0, top + 1.3, 0);
      tall = Math.min(19, 12.5 + this.floors * 0.09);
      wide = 12.5;
    } else if (this.view === "over") {
      // Step back until the whole tower is in the picture.
      this.goal.set(0, Math.max(2.4, top * 0.5 + 0.6), 0);
      tall = Math.max(10.5, top * 0.95 + 5.5);
      wide = 11.5;
    } else if (this.view === "team") {
      this.goal.set(0, Math.max(2.4, top - 1.2), 0);
      tall = Math.min(22, Math.max(11, top * 0.5 + 9));
      wide = 12.5;
    } else {
      this.goal.set(this.podium.position.x, 1.9, this.podium.position.z);
      tall = 8.4;
      wide = 9;
    }
    // Both have to fit in the free part: on a narrow screen it is the width that decides
    // (the whole swing of the crate has to be seen).
    const { x, y, w, h } = this.free;
    this.viewGoal = Math.max(tall / h, wide / (this.aspect * w));
    this.shiftGoal.set((x + w / 2 - 0.5) * this.viewGoal * this.aspect, (0.5 - (y + h / 2)) * this.viewGoal);
    if (now) {
      this.target.copy(this.goal);
      this.viewH = this.viewGoal;
      this.shift.copy(this.shiftGoal);
    }
  }

  /* ---------------------------------- loop -------------------------------- */

  /** Advances everything by `dt` seconds and draws. */
  frame(dt: number) {
    if (this.disposed) return;
    this.time += dt;
    this.world.update(dt, this.time);

    // Light, towards the zone's.
    const k = Math.min(1, dt * 1.5);
    const goal = this.lightGoal;
    this.light.ambientPower += (goal.ambientPower - this.light.ambientPower) * k;
    this.light.sunPower += (goal.sunPower - this.light.sunPower) * k;
    this.light.evening += (goal.evening - this.light.evening) * k;
    this.ambient.color.lerp(new THREE.Color(goal.ambient), k);
    this.sun.color.lerp(new THREE.Color(goal.sun), k);
    this.ambient.intensity = this.light.ambientPower;
    this.sun.intensity = this.light.sunPower;
    this.world.setEvening(this.light.evening);

    // A crate that has just landed gives a little, then stands.
    for (const s of this.squash) {
      s.t += dt;
      const p = Math.min(1, s.t / 0.2);
      s.mesh.setMatrixAt(s.index, this.crateMatrix(s.rect, s.floor, 1 - Math.sin(p * Math.PI) * 0.16));
      s.mesh.instanceMatrix.needsUpdate = true;
    }
    this.squash = this.squash.filter((s) => s.t < 0.2);

    if (this.ringLife > 0) {
      this.ringLife = Math.max(0, this.ringLife - dt * 2.6);
      const grow = 1 + (1 - this.ringLife) * 0.55;
      this.ring.scale.set(this.ringBase.x * grow, CRATE_H, this.ringBase.z * grow);
      (this.ring.material as THREE.LineBasicMaterial).opacity = this.ringLife;
      if (this.ringLife === 0) this.ring.visible = false;
    }

    for (const piece of this.pieces) {
      if (!piece.alive) continue;
      piece.velocity.y -= GRAVITY * dt;
      piece.mesh.position.addScaledVector(piece.velocity, dt);
      piece.mesh.rotation.x += piece.spin.x * dt;
      piece.mesh.rotation.y += piece.spin.y * dt;
      piece.mesh.rotation.z += piece.spin.z * dt;
      if (piece.mesh.position.y < -6) {
        piece.alive = false;
        piece.mesh.visible = false;
      }
    }

    for (let i = 0; i < this.sparkData.length; i++) {
      const s = this.sparkData[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.v.y -= GRAVITY * 0.55 * dt;
      s.p.addScaledVector(s.v, dt);
      const size = s.life > 0 ? s.size * Math.min(1, (s.life / s.span) * 1.6) : 0;
      this.sparks.setMatrixAt(i, this.matrix.makeScale(size, size, size).setPosition(s.p.x, s.p.y, s.p.z));
    }
    this.sparks.instanceMatrix.needsUpdate = true;

    // The lift climbs with the tower while it is being built, and comes back down afterwards.
    const riding = this.view === "play" || this.view === "over" || this.view === "team";
    const liftGoal = riding ? Math.max(0, BASE_Y + this.floors * CRATE_H - 1.1) : 0;
    this.liftY += (liftGoal - this.liftY) * Math.min(1, dt * 5);
    if (Math.abs(liftGoal - this.liftY) < 0.002) this.liftY = liftGoal;
    this.lift.position.y = this.liftY;
    if (Math.abs(this.liftY - this.mastDrawn) > 0.001) {
      this.mastDrawn = this.liftY;
      const whole = Math.min(MAST_SEGMENTS - 1, Math.floor(this.liftY));
      const rest = Math.min(1, this.liftY - whole);
      for (let i = 0; i < whole; i++) this.mast.setMatrixAt(i, this.matrix.makeScale(1, 1, 1).setPosition(LIFT_X, i + 0.5, LIFT_Z));
      this.mast.setMatrixAt(whole, this.matrix.makeScale(1, Math.max(0.001, rest), 1).setPosition(LIFT_X, whole + rest / 2, LIFT_Z));
      this.mast.count = rest > 0.001 ? whole + 1 : whole;
      this.mast.instanceMatrix.needsUpdate = true;
    }
    const me = this.meId ? this.cast.get(this.meId) : undefined;
    if (me && !me.parked) me.character.group.position.set(LIFT_X, this.liftY + LIFT_DECK, LIFT_Z);

    for (const walker of this.cast.values()) this.walk(walker, dt);

    // The camera goes where it is wanted, without hurry.
    this.placeCamera(false);
    const ease = Math.min(1, dt * (this.view === "play" ? 4.5 : 2.6));
    this.target.lerp(this.goal, ease);
    this.viewH += (this.viewGoal - this.viewH) * ease;
    this.shift.lerp(this.shiftGoal, ease);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const jolt = this.shake * this.shake * 2.2;
    const half = this.viewH / 2;
    this.camera.left = -half * this.aspect;
    this.camera.right = half * this.aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    // The subject is shown in the middle of the free part of the picture, not of the picture itself.
    this.eye.copy(this.target).addScaledVector(CAMERA_RIGHT, -this.shift.x).addScaledVector(CAMERA_UP, -this.shift.y);
    this.camera.position.copy(this.eye).addScaledVector(CAMERA_DIR, 120);
    this.camera.position.x += (Math.random() - 0.5) * jolt;
    this.camera.position.y += (Math.random() - 0.5) * jolt;
    this.camera.lookAt(this.eye);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private walk(walker: Walker, dt: number) {
    const { character } = walker;
    character.update(dt);
    if (walker.parked || walker.path.length < 2 || character.mood === "cheer" || character.mood === "flop") return;
    if (walker.wait > 0) {
      walker.wait -= dt;
      if (walker.wait <= 0) character.play("walk");
      return;
    }
    const [tx, tz] = walker.path[(walker.leg + 1) % walker.path.length];
    const at = character.group.position;
    const dx = tx - at.x;
    const dz = tz - at.z;
    const far = Math.hypot(dx, dz);
    if (far < 0.08) {
      walker.leg = (walker.leg + 1) % walker.path.length;
      walker.wait = this.calm ? 6 : 0.6 + Math.random() * 2.4;
      character.play("idle");
      return;
    }
    const step = Math.min(far, walker.speed * dt);
    at.x += (dx / far) * step;
    at.z += (dz / far) * step;
    character.group.rotation.y = Math.atan2(dx, dz);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.crate.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const mesh of this.stacks.values()) mesh.dispose();
    this.mast.dispose();
    this.sparks.dispose();
    this.pixels.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
