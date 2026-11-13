/**
 * TOMATO TOWER — the little farm the tower stands in.
 *
 * An island of grass in the sky: tilled rows of tomato plants, a red barn, a
 * windmill, a few trees, a fence, lanterns that light up in the evening, and
 * clouds that drift past the tower as it grows. Everything is a box.
 */
import * as THREE from "three";
import type { Pixels, PixelName } from "./pixels";

export interface World {
  group: THREE.Group;
  /** The windmill turns, the clouds drift. */
  update(dt: number, time: number): void;
  /** 0 by day, 1 at night: how bright the lanterns and the barn's window are. */
  setEvening(amount: number): void;
}

/** Where the tower's first crate sits: the top of the pallet. */
export const BASE_Y = 0.6;

export function buildWorld(pixels: Pixels, geometries: THREE.BufferGeometry[], materials: THREE.Material[]): World {
  const group = new THREE.Group();
  const cache = new Map<string, THREE.MeshLambertMaterial>();
  const material = (name: PixelName, repeat?: [number, number]) => {
    const id = repeat ? `${name}:${repeat[0]}x${repeat[1]}` : name;
    let m = cache.get(id);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ map: pixels.get(name, repeat) });
      cache.set(id, m);
      materials.push(m);
    }
    return m;
  };
  const geometry = (w: number, h: number, d: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geometries.push(g);
    return g;
  };
  /** A box whose bottom sits at `y`, centred on (x, z). `faces` gives one material, or [side, top]. */
  const block = (w: number, h: number, d: number, x: number, y: number, z: number, faces: THREE.Material | [THREE.Material, THREE.Material], parent: THREE.Object3D = group) => {
    const mats = Array.isArray(faces) ? [faces[0], faces[0], faces[1], faces[0], faces[0], faces[0]] : faces;
    const mesh = new THREE.Mesh(geometry(w, h, d), mats);
    mesh.position.set(x, y + h / 2, z);
    parent.add(mesh);
    return mesh;
  };

  // The island: small enough for the sky to take the picture over as the tower climbs.
  block(46, 1, 46, 1, -1, 1, [material("grassSide", [46, 1]), material("grassTop", [46, 46])]);
  block(42, 2.5, 42, 1, -3.5, 1, material("soil", [21, 2]));
  // Terraces at the back: the land rises away from the camera.
  block(46, 2, 10, 1, 0, -17, [material("grassSide", [46, 2]), material("grassTop", [46, 10])]);
  block(8.6, 2, 36, -17.7, 0, 6, [material("grassSide", [36, 2]), material("grassTop", [9, 36])]);
  block(30, 2, 5, -5, 2, -19.5, [material("grassSide", [30, 2]), material("grassTop", [30, 5])]);
  block(4.6, 2, 24, -19.7, 2, -5, [material("grassSide", [24, 2]), material("grassTop", [5, 24])]);

  // The tower's own ground: a stone slab and a pallet.
  block(4.4, 0.4, 4.4, 0, 0, 0, material("stone", [4, 1]));
  block(3.3, 0.2, 3.3, 0, 0.4, 0, material("plank", [3, 1]));

  // A path from the slab to the front of the island, and across.
  block(2, 0.04, 22, 0, 0, 13, material("path", [2, 22]));
  block(22, 0.04, 2, -2.4, 0, 9, material("path", [22, 2]));

  // Tilled rows with tomato plants: in front, and to the right.
  const soil = material("soil", [1, 9]);
  const bushes: [number, number][] = [];
  for (const x of [4, 6.4, 8.8, 11.2, 13.6]) {
    block(1.2, 0.14, 9, x, 0, 3, soil);
    for (let z = -0.6; z <= 6.8; z += 1.5) bushes.push([x, z]);
  }
  const soilAcross = material("soil", [1, 11]);
  for (const z of [14, 16.4, 18.8]) {
    const strip = block(1.2, 0.14, 11, 9, 0, z, soilAcross);
    strip.rotation.y = Math.PI / 2;
    for (let x = 4.2; x <= 13.8; x += 1.6) bushes.push([x, z]);
  }
  for (const z of [13, 15.4, 17.8]) {
    const strip = block(1.2, 0.14, 9, -8, 0, z, soilAcross);
    strip.rotation.y = Math.PI / 2;
    for (let x = -11.6; x <= -4.4; x += 1.6) bushes.push([x, z]);
  }
  const bush = new THREE.InstancedMesh(geometry(0.8, 0.8, 0.8), material("bush"), bushes.length * 2);
  const stake = new THREE.InstancedMesh(geometry(0.1, 1.3, 0.1), material("trunk"), bushes.length);
  const m = new THREE.Matrix4();
  bushes.forEach(([x, z], i) => {
    const tall = 0.55 + ((i * 37) % 10) / 22;
    bush.setMatrixAt(i * 2, m.makeScale(0.95, tall, 0.95).setPosition(x, 0.14 + (0.8 * tall) / 2, z));
    bush.setMatrixAt(i * 2 + 1, m.makeScale(0.62, 0.6, 0.62).setPosition(x + 0.05, 0.14 + 0.8 * tall + 0.2, z - 0.04));
    stake.setMatrixAt(i, m.makeScale(1, 1, 1).setPosition(x - 0.42, 0.14 + 0.65, z + 0.42));
  });
  group.add(bush, stake);

  // The barn, behind and to the left: red planks, white trim, a stepped roof.
  const barn = new THREE.Group();
  barn.position.set(-10, 0, -7);
  block(6, 3.2, 5, 0, 0, 0, material("barn", [6, 3]), barn);
  for (let i = 0; i < 4; i++) block(6.6 - i * 1.6, 0.55, 5.6, 0, 3.2 + i * 0.55, 0, material("roof", [6, 1]), barn);
  block(1.8, 2.2, 0.12, 0, 0, 2.56, material("plank", [2, 2]), barn);
  block(2.2, 0.16, 0.14, 0, 2.2, 2.57, material("trim"), barn);
  block(0.16, 2.2, 0.14, -1.02, 0, 2.57, material("trim"), barn);
  block(0.16, 2.2, 0.14, 1.02, 0, 2.57, material("trim"), barn);
  const window = new THREE.MeshLambertMaterial({ map: pixels.get("lantern"), emissive: new THREE.Color("#f4b331"), emissiveIntensity: 0 });
  materials.push(window);
  block(0.12, 0.9, 0.9, 3.02, 1.5, 0, window, barn);
  group.add(barn);
  for (const [x, z, h] of [[-5.4, -5.2, 1], [-5.4, -6.4, 1], [-5.4, -5.8, 2], [-6.6, -4.2, 1]] as const) {
    block(1.3, 0.9, 1, x, (h - 1) * 0.9, z, material("hay"));
  }

  // The windmill: a tower of planks under a cap, four sails that turn.
  const mill = new THREE.Group();
  mill.position.set(-6, 2, -18);
  block(2.6, 5, 2.6, 0, 0, 0, material("trim", [2, 4]), mill);
  block(2.2, 1.6, 2.2, 0, 5, 0, material("trim", [2, 1]), mill);
  block(3, 0.5, 3, 0, 6.6, 0, material("roof", [3, 1]), mill);
  block(2, 0.5, 2, 0, 7.1, 0, material("roof", [2, 1]), mill);
  const sails = new THREE.Group();
  sails.position.set(0, 5.6, 1.5);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    block(0.2, 3.6, 0.12, 0, 0.2, 0, material("trunk"), arm);
    block(1.1, 2.6, 0.06, 0.6, 1.1, 0, material("sail", [1, 3]), arm);
    sails.add(arm);
  }
  mill.add(sails);
  group.add(mill);

  // Trees: a trunk, a head of leaves in three blocks.
  for (const [x, z, s] of [[-15.6, 1.5, 1], [-16, -9, 1.2], [2, -15, 0.9], [9, -16, 1.1], [16, -14.5, 1], [-17, 13, 1.1], [17, -5, 0.9]] as const) {
    // On a terrace, a tree stands two blocks higher.
    const y = x < -13.4 || z < -12 ? 2 : 0;
    block(0.7 * s, 2.2 * s, 0.7 * s, x, y, z, material("trunk"));
    block(2.8 * s, 1.5 * s, 2.8 * s, x, y + 2 * s, z, material("leaves", [2, 1]));
    block(2 * s, 1 * s, 2 * s, x, y + 3.4 * s, z, material("leaves", [2, 1]));
    block(1.1 * s, 0.7 * s, 1.1 * s, x, y + 4.3 * s, z, material("leaves"));
  }

  // A fence along the front edges.
  const posts: [number, number][] = [];
  for (let x = -12.5; x <= 20; x += 2.5) if (Math.abs(x) > 1.6) posts.push([x, 21]);
  for (let z = -11.5; z <= 21; z += 2.5) posts.push([20, z]);
  const post = new THREE.InstancedMesh(geometry(0.26, 1.1, 0.26), material("plank"), posts.length);
  posts.forEach(([x, z], i) => post.setMatrixAt(i, m.makeTranslation(x, 0.55, z)));
  group.add(post);
  for (const y of [0.45, 0.85]) {
    block(11.8, 0.14, 0.12, -7.5, y, 21, material("plank", [12, 1]));
    block(18.4, 0.14, 0.12, 10.8, y, 21, material("plank", [18, 1]));
    block(0.12, 0.14, 33, 20, y, 4.5, material("plank", [1, 33]));
  }

  // Crates waiting their turn, beside the slab.
  const crate = material("crateSide");
  const crateTop = material("crateTop");
  for (const [x, y, z, r] of [[-3.6, 0, 1.4, 0.2], [-3.9, 0, 2.7, -0.3], [-3.7, 0.8, 2, 0.5], [5.6, 0, -3.8, 0.1]] as const) {
    block(1.1, 0.8, 1.1, x, y, z, [crate, crateTop]).rotation.y = r;
  }

  // Lanterns on posts: unlit by day.
  const glow = new THREE.MeshLambertMaterial({ map: pixels.get("lantern"), emissive: new THREE.Color("#f9c653"), emissiveIntensity: 0 });
  materials.push(glow);
  for (const [x, z] of [[2.7, 3.4], [-2.7, 3.4], [-3.4, 7.6], [7, 9.6], [1.8, 16]] as const) {
    block(0.18, 1.5, 0.18, x, 0, z, material("trunk"));
    block(0.42, 0.42, 0.42, x, 1.5, z, glow);
    block(0.52, 0.1, 0.52, x, 1.92, z, material("roof"));
  }

  // Clouds, low and high: the tower passes through them.
  const clouds: { mesh: THREE.Group; speed: number }[] = [];
  const cloudMat = material("cloud", [3, 1]);
  for (let i = 0; i < 11; i++) {
    const cloud = new THREE.Group();
    const w = 3 + (i % 3) * 1.4;
    block(w, 0.7, 2, 0, 0, 0, cloudMat, cloud);
    block(w * 0.55, 0.6, 1.5, w * 0.12, 0.7, 0, cloudMat, cloud);
    cloud.position.set(-26 + ((i * 53) % 52), 9 + i * 4.2, -14 + ((i * 29) % 22));
    group.add(cloud);
    clouds.push({ mesh: cloud, speed: 0.25 + (i % 4) * 0.12 });
  }

  return {
    group,
    update(dt, time) {
      sails.rotation.z = time * 0.5;
      for (const c of clouds) {
        c.mesh.position.x += c.speed * dt;
        if (c.mesh.position.x > 30) c.mesh.position.x = -30;
      }
    },
    setEvening(amount) {
      glow.emissiveIntensity = amount * 1.6;
      window.emissiveIntensity = amount * 1.2;
    },
  };
}
