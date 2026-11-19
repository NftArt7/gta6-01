// Solmar City — people. Low-poly pedestrians who stroll the sidewalks and
// flee when attacked, plus the player character on foot (walk/run/punch).
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick, clamp, dist2D } from './util.js';
import { collide } from './city.js';

const SKINS = [0xe8b48a, 0xc98d5f, 0x8a5a3a, 0xf2d3ac];
const SHIRTS = [0xd94f4f, 0x4f7ad9, 0x58b368, 0xe8c13c, 0x8a5fd0, 0xe07b39, 0xf2f2f2, 0x39c2c9];
const PANTS = [0x2c3a4a, 0x3a3a3a, 0x5a4a3a, 0x4a5a7a];

// A person from boxes: torso, head, arms, legs. Limbs swing when walking.
export function createPersonMesh({ skin = 0xe8b48a, shirt = 0x4f7ad9, pants = 0x2c3a4a, scale = 1 } = {}) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x241a12 }));
  hair.position.y = 1.94;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pantsMat);
  legL.position.set(-0.17, 0.36, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armL.position.set(-0.42, 1.14, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  // pivot limbs at the top so they swing naturally
  legL.geometry.translate(0, -0.32, 0); legL.position.y = 0.72;
  legR.geometry.translate(0, -0.32, 0); legR.position.y = 0.72;
  armL.geometry.translate(0, -0.26, 0); armL.position.y = 1.42;
  armR.geometry.translate(0, -0.26, 0); armR.position.y = 1.42;
  group.scale.setScalar(scale);
  return { group, legL, legR, armL, armR, head };
}

export function createCrowd(scene, city, count = 16) {
  const rng = mulberry32(4242);
  const people = [];
  for (let i = 0; i < count; i++) {
    const mesh = createPersonMesh({
      skin: pick(rng, SKINS), shirt: pick(rng, SHIRTS), pants: pick(rng, PANTS),
    });
    scene.add(mesh.group);
    const x = (rng() * 2 - 1) * city.half;
    const z = (rng() * 2 - 1) * city.half;
    people.push({
      mesh,
      x, z,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.1,
      walkPhase: rng() * Math.PI * 2,
      flee: 0, // seconds of fleeing left
      retarget: 0,
    });
  }
  return {
    people,
    update(dt, player, audio) {
      for (const p of people) {
        p.retarget -= dt;
        if (p.flee > 0) p.flee -= dt;
        const dPlayer = dist2D(p.x, p.z, player.x, player.z);
        let speed = p.speed;
        let heading = p.heading;
        if (p.flee > 0) {
          // run away from the player
          heading = Math.atan2(p.x - player.x, p.z - player.z);
          speed = 4.2;
        } else if (p.retarget <= 0) {
          p.retarget = 3 + Math.random() * 5;
          p.heading += (Math.random() - 0.5) * 1.6;
          heading = p.heading;
        }
        p.heading = heading;
        const nx = p.x + Math.sin(heading) * speed * dt;
        const nz = p.z + Math.cos(heading) * speed * dt;
        const fixed = collide(city, nx, nz, 0.5);
        p.x = fixed.x;
        p.z = fixed.z;
        p.walkPhase += dt * speed * 4.2;
        const swing = Math.sin(p.walkPhase) * 0.55;
        p.mesh.legL.rotation.x = swing;
        p.mesh.legR.rotation.x = -swing;
        p.mesh.armL.rotation.x = -swing * 0.7;
        p.mesh.armR.rotation.x = swing * 0.7;
        p.mesh.group.position.set(p.x, 0, p.z);
        p.mesh.group.rotation.y = heading;
        void dPlayer;
        void audio;
      }
    },
    // Player punches: nearest pedestrian within range flees and raises heat.
    punch(x, z, heading) {
      let best = null;
      let bestD = 2.6;
      for (const p of this.people) {
        const d = dist2D(p.x, p.z, x + Math.sin(heading) * 1.2, z + Math.cos(heading) * 1.2);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) {
        best.flee = 6;
        return true;
      }
      return false;
    },
  };
}

// The player on foot: WASD movement, Shift to sprint, F to punch.
export function createPlayerOnFoot(scene) {
  const mesh = createPersonMesh({ skin: 0xe8b48a, shirt: 0x2f6fd0, pants: 0x2c3a4a, scale: 1.05 });
  scene.add(mesh.group);
  return {
    mesh,
    x: 0, z: 0, heading: 0,
    punchTimer: 0,
    setPose(x, z, heading) {
      this.x = x; this.z = z; this.heading = heading;
      this.sync(0);
    },
    sync(dt, moving) {
      mesh.group.position.set(this.x, 0, this.z);
      mesh.group.rotation.y = this.heading;
      if (moving) {
        const s = Math.sin(performance.now() / 90) * 0.5;
        mesh.legL.rotation.x = s;
        mesh.legR.rotation.x = -s;
        mesh.armL.rotation.x = -s * 0.7;
        mesh.armR.rotation.x = s * 0.7;
      } else {
        mesh.legL.rotation.x = 0;
        mesh.legR.rotation.x = 0;
        mesh.armL.rotation.x = 0;
        mesh.armR.rotation.x = 0;
      }
      if (this.punchTimer > 0) {
        this.punchTimer -= dt;
        mesh.armR.rotation.x = -1.5; // arm extended in a punch
        mesh.armR.rotation.z = -0.3;
      } else {
        mesh.armR.rotation.z = 0;
      }
    },
    update(dt, input, city, camYaw) {
      const ax = input.axis();
      const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = run ? 8.5 : 4.6;
      // movement is relative to the camera yaw
      const fwdX = Math.sin(camYaw);
      const fwdZ = Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);
      const mx = fwdX * ax.y + rightX * ax.x;
      const mz = fwdZ * ax.y + rightZ * ax.x;
      const len = Math.hypot(mx, mz);
      let moving = false;
      if (len > 0.01) {
        const nx = this.x + (mx / len) * speed * dt;
        const nz = this.z + (mz / len) * speed * dt;
        const fixed = collide(city, nx, nz, 0.55);
        this.x = fixed.x;
        this.z = fixed.z;
        this.heading = Math.atan2(mx, mz);
        moving = true;
      }
      this.sync(dt, moving);
      return { moving, speed: moving ? speed : 0 };
    },
  };
}
