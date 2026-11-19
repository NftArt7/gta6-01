// Solmar City — procedural open-world city. A road grid of square blocks,
// each block holding one to four textured towers, with palm-lined avenues,
// a beach and ocean to the south, wooden docks to the east, a paint shop,
// and a park. Everything is generated from a fixed seed so the city is
// identical on every load (and in every screenshot).
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick, clamp } from './util.js';
import { facadeTexture, roofTexture, roadTexture, pavementTexture, grassTexture, sandTexture, signTexture } from './textures.js';

export const CITY = {
  block: 44,      // block side length
  road: 14,       // road width
  halfBlocks: 3,  // blocks from -3..3
  beachZ: 218,    // sand starts here (south edge)
  oceanZ: 252,
};

export function buildCity() {
  const rng = mulberry32(20261119);
  const group = new THREE.Group();
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const { block, road, halfBlocks } = CITY;
  const pitch = block + road;
  const half = halfBlocks * pitch + block / 2 + road / 2; // city half-extent

  // --- ground: grass base, sand beach, ocean ---
  const grassTex = grassTexture();
  grassTex.repeat.set(24, 24);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, half * 2 + 340),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const sandTex = sandTexture();
  sandTex.repeat.set(30, 4);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, 44),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 20);
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 320, 180),
    new THREE.MeshLambertMaterial({ color: 0x1d6f9e, transparent: true, opacity: 0.92 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.1, CITY.oceanZ + 90);
  group.add(ocean);

  // --- roads: one dark plane per avenue, plus intersections ---
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadLines = [];
  for (let i = -halfBlocks; i <= halfBlocks; i++) {
    roadLines.push(i * pitch);
  }
  const roadLen = half * 2 + road;
  for (const c of roadLines) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(road, roadLen), roadMat.clone());
    v.material.map = roadTex.clone();
    v.material.map.repeat.set(1, roadLen / 16);
    v.material.map.needsUpdate = true;
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.06, 0);
    v.receiveShadow = true;
    group.add(v);
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, road), roadMat.clone());
    hz.material.map = roadTex.clone();
    hz.material.map.repeat.set(roadLen / 16, 1);
    hz.material.map.needsUpdate = true;
    hz.rotation.x = -Math.PI / 2;
    hz.position.set(0, 0.06, c);
    hz.receiveShadow = true;
    group.add(hz);
  }

  // --- blocks: pavement slabs + buildings ---
  const paveTex = pavementTexture();
  const buildings = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -halfBlocks; bx <= halfBlocks; bx++) {
    for (let bz = -halfBlocks; bz <= halfBlocks; bz++) {
      const cx = bx * pitch;
      const cz = bz * pitch;
      // park in the centre block
      if (bx === 0 && bz === 0) {
        const park = new THREE.Mesh(
          new THREE.PlaneGeometry(block, block),
          new THREE.MeshLambertMaterial({ map: grassTexture() }),
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(cx, 0.07, cz);
        group.add(park);
        // fountain
        const fountain = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 6, 1.2, 20),
          new THREE.MeshLambertMaterial({ color: 0x9aa5ad }),
        );
        fountain.position.set(cx, 0.6, cz);
        group.add(fountain);
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(4.4, 4.4, 0.4, 20),
          new THREE.MeshLambertMaterial({ color: 0x3fa7d6 }),
        );
        water.position.set(cx, 1.1, cz);
        group.add(water);
        colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 6, maxZ: cz + 6 });
        addTrees(group, rng, cx, cz, 10);
        continue;
      }
      const slab = new THREE.Mesh(
        new THREE.PlaneGeometry(block, block),
        new THREE.MeshLambertMaterial({ map: paveTex }),
      );
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.07, cz);
      slab.receiveShadow = true;
      group.add(slab);

      const nB = 1 + Math.floor(rng() * 3);
      for (let b = 0; b < nB; b++) {
        const w = 12 + rng() * 14;
        const d = 12 + rng() * 14;
        const h = 12 + rng() * rng() * 46;
        const ox = (rng() - 0.5) * (block - w - 4);
        const oz = (rng() - 0.5) * (block - d - 4);
        const x = cx + ox;
        const z = cz + oz;
        const facade = facadeTexture(1000 + Math.floor(rng() * 9000));
        const mats = [
          new THREE.MeshLambertMaterial({ map: facade }),
          new THREE.MeshLambertMaterial({ map: facade }),
          new THREE.MeshLambertMaterial({ map: roofTexture(Math.floor(rng() * 9000)) }),
          new THREE.MeshLambertMaterial({ color: 0x555555 }),
          new THREE.MeshLambertMaterial({ map: facade }),
          new THREE.MeshLambertMaterial({ map: facade }),
        ];
        const tower = new THREE.Mesh(boxGeo, mats);
        tower.scale.set(w, h, d);
        tower.position.set(x, h / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        // rooftop AC box on tall towers
        if (h > 30) {
          const ac = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
          ac.scale.set(4, 2, 3);
          ac.position.set(x + w / 4, h + 1, z);
          group.add(ac);
        }
        buildings.push({ x, z, w, d, h });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      if (rng() < 0.7) addTrees(group, rng, cx, cz, 3);
    }
  }

  // --- palms along the beach front ---
  for (let x = -half + 10; x < half; x += 18) {
    addPalm(group, x + (rng() - 0.5) * 6, CITY.beachZ - 6 + rng() * 8, 5 + rng() * 2.5);
  }

  // --- paint shop: a low garage with a neon sign at the west edge ---
  const paintShop = { x: -half - 2, z: -pitch };
  const shop = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd9534f }));
  shop.scale.set(20, 7, 14);
  shop.position.set(paintShop.x, 3.5, paintShop.z);
  shop.castShadow = true;
  group.add(shop);
  colliders.push({ minX: paintShop.x - 10, maxX: paintShop.x + 10, minZ: paintShop.z - 7, maxZ: paintShop.z + 7 });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: signTexture('PAINT SHOP', '#ff5da2') }),
  );
  sign.position.set(paintShop.x, 7.6, paintShop.z + 7.2);
  group.add(sign);
  // paint bay: open pad in front of the shop (mission 1 target)
  const bay = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 12),
    new THREE.MeshLambertMaterial({ color: 0x44484e }),
  );
  bay.rotation.x = -Math.PI / 2;
  bay.position.set(paintShop.x, 0.08, paintShop.z + 14);
  group.add(bay);

  // --- docks: wooden pier on the east edge ---
  const docks = { x: half + 26, z: pitch };
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(34, 1.4, 10),
    new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
  );
  pier.position.set(docks.x, 0.7, docks.z);
  pier.castShadow = true;
  group.add(pier);
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, [0xb5893c, 0x7a9e4f, 0x4f7a9e]) }));
    crate.scale.set(2.4, 2.4, 2.4);
    crate.position.set(docks.x - 12 + i * 5.5, 2.6, docks.z + (i % 2 ? 2.4 : -2.4));
    crate.castShadow = true;
    group.add(crate);
  }
  const dockSign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('SOLMAR DOCKS', '#4fc3f7') }),
  );
  dockSign.position.set(docks.x - 2, 6, docks.z - 5.4);
  dockSign.rotation.y = Math.PI;
  group.add(dockSign);

  // --- sky: gradient dome + sun + distant clouds ---
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87bfe8, side: THREE.BackSide, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }),
  );
  sun.position.set(-420, 320, -620);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(14 + rng() * 16, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    );
    cloud.scale.y = 0.35;
    cloud.position.set(-500 + rng() * 1000, 180 + rng() * 80, -500 + rng() * 900);
    group.add(cloud);
  }

  // --- street lights along the main avenues ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of roadLines) {
    for (let t = -half + 20; t < half; t += 58) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(c + 8, 3.5, t);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
      lamp.position.set(c + 8, 7.1, t);
      group.add(lamp);
    }
  }

  return {
    group,
    colliders,
    buildings,
    roadLines,
    half,
    pitch,
    paintShop,
    docks,
    delivery: { x: pitch * 2, z: -pitch * 2 }, // a door on the north-east block
    beachZ: CITY.beachZ,
    spawn: { x: 0, z: pitch * 2 + 4 }, // player spawn on the avenue by the park
  };
}

function addTrees(group, rng, cx, cz, n) {
  for (let i = 0; i < n; i++) {
    const x = cx + (rng() - 0.5) * (CITY.block - 8);
    const z = cz + (rng() - 0.5) * (CITY.block - 8);
    addPalm(group, x, z, 4 + rng() * 2);
  }
}

function addPalm(group, x, z, h) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, h, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
  );
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.1, h + 0.6, z + Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
}

// Circle-vs-AABB collision: push the point out, return corrected position.
export function collide(city, x, z, r) {
  let nx = x;
  let nz = z;
  for (const c of city.colliders) {
    const cx = clamp(nx, c.minX, c.maxX);
    const cz = clamp(nz, c.minZ, c.maxZ);
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = nx - c.minX, pr = c.maxX - nx, pt = nz - c.minZ, pb = c.maxZ - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = c.minX - r;
        else if (m === pr) nx = c.maxX + r;
        else if (m === pt) nz = c.minZ - r;
        else nz = c.maxZ + r;
      }
    }
  }
  return { x: nx, z: nz };
}

export function insideCity(city, x, z) {
  const lim = city.half + 40;
  return Math.abs(x) < lim && z > -city.half - 20 && z < CITY.beachZ + 8;
}
