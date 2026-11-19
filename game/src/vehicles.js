// Cars: a box-built fleet (sedans, taxis, trucks, sports cars, police),
// arcade driving physics, and the traffic that fills Solmar's streets.

import * as THREE from 'three';
import { CFG, CAR_COLORS } from './config.js';

// Builds one car from boxes: body, cabin, four wheels, headlights and
// tail lights. Police cars get a light bar whose lenses flash in the
// update loop. `forward` is +Z when heading is 0.
export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.8 });
  const low = kind === 'sports';
  const bodyH = low ? 0.55 : 0.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, low ? 1.9 : 2.3), glass);
  cabin.position.set(0, 0.55 + bodyH / 2 + 0.28, low ? -0.3 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), paint);
    spoiler.position.set(0, 1.15, -2.1);
    group.add(spoiler);
  }
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2.0), new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.9 }));
    bed.position.set(0, 1.0, -1.0);
    group.add(bed);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xf0c020, emissive: 0xa08000, emissiveIntensity: 0.5 })
    );
    sign.position.set(0, 1.55, -0.2);
    group.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 });
  const wheels = [];
  const spots = [
    [-0.95, 1.45],
    [0.95, 1.45],
    [-0.95, -1.45],
    [0.95, -1.45],
  ];
  for (const [x, z] of spots) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xffedb0, emissiveIntensity: 1.2 });
  for (const x of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    head.position.set(x, 0.62, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xa02020, emissive: 0xc02020, emissiveIntensity: 1 })
    );
    tail.position.set(x, 0.62, -2.21);
    group.add(tail);
  }
  let lightBar = null;
  if (kind === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xc02020, emissive: 0xff2020, emissiveIntensity: 2 })
    );
    red.position.x = -0.35;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2040c0, emissive: 0x2040ff, emissiveIntensity: 2 })
    );
    blue.position.x = 0.35;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    lightBar = { red: red.material, blue: blue.material };
  }
  return { group, wheels, lightBar };
}

// One car's driving state. Position lives in {x, z} on the ground plane;
// heading 0 faces +Z, positive heading turns toward +X.
export function makeCar(kind, color, x, z, heading = 0) {
  const built = makeCarMesh(color, kind);
  built.group.position.set(x, 0, z);
  built.group.rotation.y = heading;
  return {
    kind,
    color,
    mesh: built.group,
    wheels: built.wheels,
    lightBar: built.lightBar,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    // Traffic only: waypoints the car loops through.
    route: null,
    routeIndex: 0,
  };
}

// Arcade driving: throttle builds speed, steering bites harder the faster
// you go, the handbrake breaks the rear loose. Returns nothing; the car
// object is updated in place.
export function driveCar(car, ctrl, dt) {
  const c = CFG;
  if (ctrl.throttle > 0) {
    car.speed += c.carAccel * ctrl.throttle * dt * (1 - Math.max(0, car.speed) / c.carMaxSpeed);
  }
  if (ctrl.brake > 0) {
    if (car.speed > 0.5) {
      car.speed -= c.carBrake * ctrl.brake * dt;
    } else {
      car.speed -= c.carReverse * ctrl.brake * dt;
      if (car.speed < -c.carMaxReverse) car.speed = -c.carMaxReverse;
    }
  }
  if (ctrl.throttle <= 0 && ctrl.brake <= 0) {
    car.speed -= car.speed * 0.5 * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  if (ctrl.handbrake) {
    car.speed -= car.speed * 2.2 * dt;
  }
  const grip = ctrl.handbrake ? 0.55 : 1;
  const steerAuthority = Math.max(-1, Math.min(1, car.speed / 9));
  // Steer +1 is D / right: with forward (sin h, cos h) and screen-right
  // (-cos h, sin h), turning right DECREASES the heading.
  car.heading -= ctrl.steer * c.carSteer * grip * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
  car.steer = ctrl.steer;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (let i = 0; i < car.wheels.length; i++) {
    car.wheels[i].rotation.x += (car.speed * dt) / 0.36;
  }
}

// A rectangular loop around one city block, on the roads that border it.
function blockLoop(rng, roadCentres) {
  const blocks = [];
  for (let i = 0; i < roadCentres.length - 1; i++) {
    blocks.push((roadCentres[i] + roadCentres[i + 1]) / 2);
  }
  const bx = rng.pick(blocks);
  const bz = rng.pick(blocks);
  const lane = 2.6;
  const corners = [
    { x: bx - CFG.pitch / 2 + lane, z: bz - CFG.pitch / 2 + lane },
    { x: bx + CFG.pitch / 2 - lane, z: bz - CFG.pitch / 2 + lane },
    { x: bx + CFG.pitch / 2 - lane, z: bz + CFG.pitch / 2 - lane },
    { x: bx - CFG.pitch / 2 + lane, z: bz + CFG.pitch / 2 - lane },
  ];
  return rng.chance(0.5) ? corners : corners.reverse();
}

// Spawns the city's traffic: sedans, taxis and a truck, each looping a
// block forever. Returns the list of traffic cars.
export function createTraffic(scene, rng, roadCentres, count) {
  const traffic = [];
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const kind = roll < 0.62 ? 'sedan' : roll < 0.85 ? 'taxi' : 'truck';
    const colors = CAR_COLORS[kind];
    const color = rng.pick(colors);
    const route = blockLoop(rng, roadCentres);
    const start = route[0];
    const car = makeCar(kind, color, start.x, start.z, 0);
    car.route = route;
    car.routeIndex = 1;
    car.speed = CFG.trafficSpeed * rng.range(0.85, 1.1);
    scene.add(car.mesh);
    traffic.push(car);
  }
  return traffic;
}

// Moves one traffic car along its loop: steer toward the next corner,
// slow into the turn, never stop.
export function updateTrafficCar(car, dt) {
  const target = car.route[car.routeIndex];
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    car.routeIndex = (car.routeIndex + 1) % car.route.length;
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-1, Math.min(1, diff * 1.4));
  const slow = dist < 14 ? 0.55 : 1;
  car.heading += turn * 1.6 * dt;
  car.speed = CFG.trafficSpeed * slow;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (let i = 0; i < car.wheels.length; i++) {
    car.wheels[i].rotation.x += (car.speed * dt) / 0.36;
  }
}
