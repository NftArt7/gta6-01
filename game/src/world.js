// Solmar City itself: the grid, the towers, the docks, the props. The whole
// road network is ONE painted canvas texture on a single slab, so there is
// no z-fighting and one draw call for every street in the city.

import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { facadeTexture, billboardTexture, groundTexture } from './textures.js';

// Paints the city map: sidewalks, asphalt bands, dashes, crosswalks and a
// couple of green park blocks, onto one 1024 canvas for the ground slab.
function cityMapTexture(rng) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  const toPx = (u) => ((u + CFG.half) / (CFG.half * 2)) * S;
  const roadPx = (CFG.roadWidth / (CFG.half * 2)) * S;

  // Sidewalk base.
  g.fillStyle = '#b8b0a0';
  g.fillRect(0, 0, S, S);
  // Park blocks: the centre block and two others go green.
  const parks = new Set(['0,0', '-2,-2', '2,2']);
  const centres = [];
  for (let i = 0; i < CFG.blocks; i++) {
    centres.push((i - (CFG.blocks - 1) / 2) * CFG.pitch);
  }
  for (const bx of centres) {
    for (const bz of centres) {
      const key = `${Math.round(bx / CFG.pitch)},${Math.round(bz / CFG.pitch)}`;
      if (parks.has(key)) {
        g.fillStyle = '#7a9a5a';
        g.fillRect(toPx(bx - CFG.blockSize / 2), toPx(bz - CFG.blockSize / 2), (CFG.blockSize / (CFG.half * 2)) * S, (CFG.blockSize / (CFG.half * 2)) * S);
      }
    }
  }
  // Asphalt bands.
  g.fillStyle = '#33363c';
  for (const c of CFG.roadCentres()) {
    g.fillRect(toPx(c) - roadPx / 2, 0, roadPx, S);
    g.fillRect(0, toPx(c) - roadPx / 2, S, roadPx);
  }
  // Centre dashes.
  g.fillStyle = '#f0d040';
  for (const c of CFG.roadCentres()) {
    for (let u = -CFG.half; u < CFG.half; u += 16) {
      g.fillRect(toPx(c) - 2, toPx(u), 4, 16);
      g.fillRect(toPx(u), toPx(c) - 2, 16, 4);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#e8e8e8';
  for (const cx of CFG.roadCentres()) {
    for (const cz of CFG.roadCentres()) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(toPx(cx + k * 3) - 1, toPx(cz) - roadPx / 2, 2, roadPx / 2 - 4);
        g.fillRect(toPx(cx) - roadPx / 2, toPx(cz + k * 3) - 1, roadPx / 2 - 4, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeLamp() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 8), poleMat);
  pole.position.y = 3.25;
  pole.castShadow = true;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.6), poleMat);
  arm.position.set(0, 6.4, 0.7);
  group.add(arm);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd98a, emissiveIntensity: 0.9 })
  );
  bulb.position.set(0, 6.3, 1.4);
  group.add(bulb);
  return group;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 5, 7),
    new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 })
  );
  trunk.position.y = 2.5;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palm, roughness: 1, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.5, 7, 5), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.scale.set(1.4, 0.32, 0.6);
    leaf.position.set(Math.cos(a) * 0.9, 5.1, Math.sin(a) * 0.9);
    leaf.rotation.y = -a;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

// Builds the city into `scene` and returns the gameplay data: colliders,
// mission anchors and the road layout.
export function buildWorld(scene, rng) {
  const colliders = [];
  const centres = [];
  for (let i = 0; i < CFG.blocks; i++) centres.push((i - (CFG.blocks - 1) / 2) * CFG.pitch);

  // Sky, fog and light.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 260, 720);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.set(140, 190, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Outer ground and the painted city slab.
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  scene.add(outer);
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.half * 2, CFG.half * 2),
    new THREE.MeshStandardMaterial({ map: cityMapTexture(rng), roughness: 0.95 })
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = 0.02;
  slab.receiveShadow = true;
  scene.add(slab);

  // Water on the east side, with a pier and containers for the docks.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 560),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(CFG.half + 140, -0.08, 0);
  water.receiveShadow = true;
  scene.add(water);
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 16), pierMat);
  pier.position.set(CFG.half + 23, 0.4, 0);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  colliders.push({ minX: CFG.half, maxX: CFG.half + 46, minZ: -8, maxZ: 8 });
  const containerColors = [0xc05040, 0x4070c0, 0x50a060, 0xd0a030, 0x8050a0];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(7, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.8, metalness: 0.3 })
    );
    c.position.set(CFG.half + 8 + (i % 3) * 9, 1.5 + Math.floor(i / 3) * 2.7, -24 + (i % 2) * 6);
    c.rotation.y = rng.range(-0.06, 0.06);
    c.castShadow = true;
    scene.add(c);
    colliders.push({ minX: c.position.x - 3.6, maxX: c.position.x + 3.6, minZ: c.position.z - 1.4, maxZ: c.position.z + 1.4 });
  }

  // Buildings: 2-3 per block, taller toward the centre. The centre block
  // is a park with a fountain instead of towers.
  const parks = new Set(['0,0']);
  for (const bx of centres) {
    for (const bz of centres) {
      const key = `${Math.round(bx / CFG.pitch)},${Math.round(bz / CFG.pitch)}`;
      if (parks.has(key)) {
        const fountain = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 5.6, 1, 20),
          new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 })
        );
        fountain.position.set(bx, 0.5, bz);
        fountain.castShadow = true;
        scene.add(fountain);
        const jet = new THREE.Mesh(
          new THREE.CylinderGeometry(3.4, 3.4, 0.3, 20),
          new THREE.MeshStandardMaterial({ color: 0x4aa8cc, roughness: 0.2, metalness: 0.2 })
        );
        jet.position.set(bx, 1.05, bz);
        scene.add(jet);
        colliders.push({ minX: bx - 5.6, maxX: bx + 5.6, minZ: bz - 5.6, maxZ: bz + 5.6 });
        continue;
      }
      const plots = rng.shuffle([
        [-10, -10],
        [10, -10],
        [-10, 10],
        [10, 10],
      ]);
      const n = rng.int(2, 3);
      for (let p = 0; p < n; p++) {
        const [ox, oz] = plots[p];
        const w = rng.range(10, 16);
        const d = rng.range(10, 16);
        const dist = Math.hypot(bx, bz);
        const h = rng.range(8, 12) + (1 - dist / 220) * rng.range(10, 26);
        const color = rng.pick(PALETTE.building);
        const hex = `#${color.toString(16).padStart(6, '0')}`;
        const floors = Math.max(2, Math.round(h / 4));
        const cols = Math.max(2, Math.round(w / 3));
        const mat = new THREE.MeshStandardMaterial({
          map: facadeTexture(hex, floors, cols, rng),
          roughness: 0.9,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(bx + ox, h / 2 + 0.02, bz + oz);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 })
        );
        roof.position.set(bx + ox, h + 0.25, bz + oz);
        scene.add(roof);
        colliders.push({
          minX: bx + ox - w / 2,
          maxX: bx + ox + w / 2,
          minZ: bz + oz - d / 2,
          maxZ: bz + oz + d / 2,
        });
      }
    }
  }

  // Lamps at intersections and palms along the roads.
  for (const cx of CFG.roadCentres()) {
    for (const cz of CFG.roadCentres()) {
      if (rng.chance(0.45)) {
        const lamp = makeLamp();
        lamp.position.set(cx + 8.4, 0, cz + 8.4);
        lamp.rotation.y = rng.range(0, Math.PI * 2);
        scene.add(lamp);
      }
    }
  }
  for (const c of CFG.roadCentres()) {
    for (let u = -CFG.half + 14; u < CFG.half - 10; u += 28) {
      if (rng.chance(0.55)) {
        const palm = makePalm(rng);
        palm.position.set(c + 8.6, 0, u);
        scene.add(palm);
      }
      if (rng.chance(0.55)) {
        const palm2 = makePalm(rng);
        palm2.position.set(u, 0, c - 8.6);
        scene.add(palm2);
      }
    }
  }

  // Billboards on poles at three busy corners.
  const boards = [
    { pos: [84, 28], title: 'SOLMAR CITY', sub: 'sun · sea · speed', bg: '#e05038', fg: '#ffffff' },
    { pos: [-28, -84], title: 'COMET GT', sub: 'steal the sun', bg: '#20242a', fg: '#f0c020' },
    { pos: [-84, 84], title: "DELIA'S", sub: 'we fix everything', bg: '#2a6a4a', fg: '#ffffff' },
  ];
  for (const b of boards) {
    const tex = billboardTexture(b.title, b.sub, b.bg, b.fg);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide })
    );
    board.position.set(b.pos[0], 9, b.pos[1]);
    board.rotation.y = Math.PI / 4;
    board.castShadow = true;
    scene.add(board);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, metalness: 0.5 })
    );
    pole.position.set(b.pos[0], 4.5, b.pos[1]);
    scene.add(pole);
  }

  // Drifting clouds, purely visual.
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 12), 10, 8), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(k * rng.range(7, 11) - 10, rng.range(-1, 1), rng.range(-3, 3));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-220, 220), rng.range(90, 130), rng.range(-220, 220));
    scene.add(cloud);
  }

  // Mission anchors: all on roads (or the pier), so a car can reach them.
  const anchors = {
    showroom: { x: 84, z: -84 },
    garage: { x: -84, z: 84 },
    docks: { x: CFG.half + 20, z: 0 },
    warehouse: { x: -84, z: -84 },
    hideout: { x: 28, z: 140 },
    sprint: [
      { x: 140, z: -28 },
      { x: -140, z: 28 },
      { x: 28, z: 140 },
      { x: -28, z: -140 },
      { x: 84, z: 140 },
      { x: -84, z: -140 },
    ],
  };

  return { colliders, anchors, roadCentres: CFG.roadCentres(), half: CFG.half, sun };
}
