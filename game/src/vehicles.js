// Solmar City — vehicles. The player car, ambient traffic that follows the
// road grid, and police cruisers that chase and ram the player while wanted.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick, clamp, angleDelta, dist2D } from './util.js';
import { collide } from './city.js';

const CAR_COLORS = [0xd94f4f, 0x4f7ad9, 0xe8c13c, 0x58b368, 0xe8e8e8, 0x8a5fd0, 0xe07b39, 0x39c2c9];

// A low-poly car: body, cabin, four spinning wheels, headlights, taillights.
export function createCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), darkMat);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.7), bodyMat);
  nose.position.set(0, 0.5, 2.25);
  group.add(nose);
  // headlights / taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    hl.position.set(sx, 0.62, 2.62);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    tl.position.set(sx, 0.62, -2.12);
    group.add(tl);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    group.add(w);
    wheels.push(w);
  }
  let lightbar = null;
  if (police) {
    lightbar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    lightbar.position.set(0, 1.55, -0.25);
    group.add(lightbar);
  }
  return { group, wheels, lightbar };
}

// --- player car physics: arcade, front-wheel steer, building collision ---
export function createPlayerCar(scene) {
  const mesh = createCarMesh(0xd94f4f);
  scene.add(mesh.group);
  const car = {
    mesh,
    x: 0, z: 0, heading: 0, speed: 0,
    active: false, // false while the player is on foot
    setPose(x, z, heading) {
      this.x = x; this.z = z; this.heading = heading;
      this.sync();
    },
    sync() {
      mesh.group.position.set(this.x, 0, this.z);
      mesh.group.rotation.y = this.heading;
      for (const w of mesh.wheels) w.rotation.x += this.speed * 0.016 * 2.4;
    },
    update(dt, input, city, audio) {
      const ax = input.axis();
      const forward = ax.y; // W = +1
      const steer = ax.x;
      const maxSpeed = 34;
      const accel = 22;
      if (forward > 0) this.speed += accel * dt;
      else if (forward < 0) this.speed -= accel * 0.9 * dt;
      else this.speed -= Math.sign(this.speed) * 8 * dt;
      if (input.isDown('Space')) this.speed -= Math.sign(this.speed) * 26 * dt;
      this.speed = clamp(this.speed, -12, maxSpeed);
      if (Math.abs(this.speed) < 0.2 && forward === 0) this.speed = 0;
      const turnRate = 1.9 * clamp(Math.abs(this.speed) / 10, 0.25, 1);
      this.heading += steer * turnRate * dt * (this.speed >= 0 ? 1 : -1) * (Math.abs(this.speed) > 0.5 ? 1 : 0);
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const fixed = collide(city, nx, nz, 1.6);
      if (fixed.x !== nx || fixed.z !== nz) {
        // bumped a wall: lose speed, thud
        if (Math.abs(this.speed) > 6) audio.crash();
        this.speed *= 0.35;
      }
      this.x = fixed.x;
      this.z = fixed.z;
      this.sync();
      audio.engine(Math.abs(this.speed) / maxSpeed, true);
      return { speed: this.speed };
    },
  };
  return car;
}

// --- traffic: cars looping around the road grid ---
export function createTraffic(scene, city, count = 10) {
  const rng = mulberry32(777);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const color = pick(rng, CAR_COLORS);
    const mesh = createCarMesh(color);
    scene.add(mesh.group);
    const line = pick(rng, city.roadLines);
    const horizontal = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = (rng() < 0.5 ? -3.4 : 3.4);
    cars.push({
      mesh,
      horizontal,
      line,
      lane,
      dir,
      speed: 7 + rng() * 5,
      t: (rng() * 2 - 1) * city.half,
      heading: 0,
    });
  }
  return {
    cars,
    update(dt, playerPos) {
      for (const c of cars) {
        // slow down if the player is right ahead
        let sp = c.speed;
        if (playerPos) {
          const cx = c.horizontal ? c.t : c.line + c.lane;
          const cz = c.horizontal ? c.line + c.lane : c.t;
          if (dist2D(cx, cz, playerPos.x, playerPos.z) < 9) sp = c.speed * 0.25;
        }
        c.t += c.dir * sp * dt;
        if (c.t > city.half + 30) c.t = -city.half - 30;
        if (c.t < -city.half - 30) c.t = city.half + 30;
        const x = c.horizontal ? c.t : c.line + c.lane;
        const z = c.horizontal ? c.line + c.lane : c.t;
        c.heading = c.horizontal ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
        c.mesh.group.position.set(x, 0, z);
        c.mesh.group.rotation.y = c.heading;
        for (const w of c.mesh.wheels) w.rotation.x += sp * dt * 2.4;
      }
    },
    // nearest traffic car to a point (for stealing)
    nearest(x, z, maxDist = 5) {
      let best = null;
      let bestD = maxDist;
      for (const c of cars) {
        const cx = c.horizontal ? c.t : c.line + c.lane;
        const cz = c.horizontal ? c.line + c.lane : c.t;
        const d = dist2D(cx, cz, x, z);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    },
    // remove a car from traffic (stolen by the player)
    remove(car) {
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
    // respawn a fresh traffic car far from the player
    respawn(scene, city, playerPos) {
      const rng2 = mulberry32((Math.random() * 1e9) | 0);
      const mesh = createCarMesh(pick(rng2, CAR_COLORS));
      scene.add(mesh.group);
      const line = pick(rng2, city.roadLines);
      const horizontal = rng2() < 0.5;
      const dir = rng2() < 0.5 ? 1 : -1;
      cars.push({
        mesh, horizontal, line,
        lane: rng2() < 0.5 ? -3.4 : 3.4,
        dir, speed: 7 + rng2() * 5,
        t: playerPos ? -city.half - 20 : 0,
        heading: 0,
      });
    },
  };
}

// --- police: cruisers spawn at the wanted level and chase the player ---
export function createPolice(scene, city) {
  const cruisers = [];
  let flash = 0;
  return {
    cruisers,
    count() { return cruisers.length; },
    setWanted(n) {
      const want = Math.min(n, 3);
      while (cruisers.length < want) {
        const mesh = createCarMesh(0x1c2f6e, true);
        scene.add(mesh.group);
        cruisers.push({
          mesh,
          x: (Math.random() - 0.5) * 120,
          z: (Math.random() - 0.5) * 120,
          heading: 0,
          speed: 0,
        });
      }
      while (cruisers.length > want) {
        const c = cruisers.pop();
        scene.remove(c.mesh.group);
      }
    },
    update(dt, target, targetSpeed, onRam) {
      flash += dt;
      for (const c of cruisers) {
        const d = dist2D(c.x, c.z, target.x, target.z);
        const wantHeading = Math.atan2(target.x - c.x, target.z - c.z);
        c.heading += clamp(angleDelta(c.heading, wantHeading), -2.4 * dt, 2.4 * dt);
        const maxSp = 26 + (d > 60 ? 8 : 0);
        c.speed = clamp(c.speed + 16 * dt, 0, maxSp);
        const nx = c.x + Math.sin(c.heading) * c.speed * dt;
        const nz = c.z + Math.cos(c.heading) * c.speed * dt;
        const fixed = collide(city, nx, nz, 1.6);
        c.x = fixed.x;
        c.z = fixed.z;
        c.mesh.group.position.set(c.x, 0, c.z);
        c.mesh.group.rotation.y = c.heading;
        if (c.mesh.lightbar) {
          c.mesh.lightbar.material.color.setHex(Math.floor(flash * 2) % 2 === 0 ? 0xff2222 : 0x2244ff);
        }
        for (const w of c.mesh.wheels) w.rotation.x += c.speed * dt * 2.4;
        if (d < 3.4) {
          // ram: shove the player and deal damage
          onRam(c);
          c.speed *= 0.4;
        }
      }
    },
  };
}
