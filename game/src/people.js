// Pedestrians: Solmar's sidewalk crowd. They stroll the pavements, cross
// at corners, and scatter when a car comes at them too fast.

import * as THREE from 'three';
import { CFG } from './config.js';

const SHIRTS = [0xd05050, 0x50a0d0, 0x50c080, 0xe0c040, 0xa060c0, 0xe08040, 0x608080, 0xd0d0d0];

function makePedMesh(shirtColor, rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.05, 8), shirt);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: rng.pick([0xe8b890, 0xc89068, 0x8a5a38, 0xf0c8a0]), roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.9 });
  for (const x of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), legs);
    leg.position.set(x, 0.28, 0);
    group.add(leg);
  }
  return group;
}

// Spawns pedestrians on the sidewalks: each walks one road's pavement,
// turning at corners. Returns the list.
export function createPedestrians(scene, rng, roadCentres, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePedMesh(rng.pick(SHIRTS), rng);
    const road = rng.pick(roadCentres);
    const along = rng.chance(0.5);
    const x = along ? rng.range(-CFG.half + 10, CFG.half - 10) : road + rng.pick([-9.5, 9.5]);
    const z = along ? road + rng.pick([-9.5, 9.5]) : rng.range(-CFG.half + 10, CFG.half - 10);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 1.9),
      walkPhase: rng.range(0, Math.PI * 2),
      fleeTimer: 0,
      along,
      road,
    });
  }
  return peds;
}

// One step for every pedestrian: stroll, turn at corners, and run when a
// fast car gets close. `threat` is {x, z, speed} of the player's car (or
// the player on foot), or null.
export function updatePeds(peds, dt, threat, rng) {
  for (const p of peds) {
    let speed = p.speed;
    let heading = p.heading;
    if (threat && threat.speed > 4) {
      const dx = p.x - threat.x;
      const dz = p.z - threat.z;
      const d = Math.hypot(dx, dz);
      if (d < 8) {
        p.fleeTimer = 1.4;
      }
    }
    if (p.fleeTimer > 0) {
      p.fleeTimer -= dt;
      speed = 4.2;
      // Run away from the threat, along the pavement, not into the road.
      const away = Math.atan2(p.x - threat.x, p.z - threat.z);
      heading = away;
    } else {
      // Stroll along the current road; at an intersection, turn onto the
      // crossing road: snap to its pavement and walk along the new axis.
      const onX = p.along;
      const cross = onX ? p.x : p.z;
      const nearRoad = CFG.roadCentres().find((c) => Math.abs(cross - c) < 1.6);
      if (nearRoad !== undefined && rng.next() < dt * 0.35) {
        if (onX) {
          p.along = false;
          p.x = nearRoad + (p.x < nearRoad ? -9.5 : 9.5);
          heading = rng.chance(0.5) ? 0 : Math.PI;
        } else {
          p.along = true;
          p.z = nearRoad + (p.z < nearRoad ? -9.5 : 9.5);
          heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        }
        p.road = nearRoad;
      }
    }
    p.heading = heading;
    p.x += Math.sin(heading) * speed * dt;
    p.z += Math.cos(heading) * speed * dt;
    // Keep inside the city.
    p.x = Math.max(-CFG.half, Math.min(CFG.half, p.x));
    p.z = Math.max(-CFG.half, Math.min(CFG.half, p.z));
    p.walkPhase += dt * speed * 3;
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.05, p.z);
    p.mesh.rotation.y = heading;
  }
}
