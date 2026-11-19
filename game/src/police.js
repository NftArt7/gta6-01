// The wanted system and the Solmar PD: stars that rise with every crime,
// police cars that spawn to match them, chase, ram, and — if they pin you
// down — bust you.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';

// Heat is a float from 0 to 5; the displayed stars are its floor. Crimes
// add heat at once; heat only cools when no police car is close and no
// crime has happened recently.
export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.sinceCrime = 999;
  }

  get stars() {
    return Math.max(0, Math.min(5, Math.floor(this.heat)));
  }

  addHeat(amount) {
    this.heat = Math.min(5, this.heat + amount);
    this.sinceCrime = 0;
  }

  clear() {
    this.heat = 0;
    this.sinceCrime = 999;
  }

  update(dt, nearestPoliceDist) {
    this.sinceCrime += dt;
    if (this.heat > 0 && this.sinceCrime > CFG.heatDecaySeconds && nearestPoliceDist > 55) {
      this.heat = Math.max(0, this.heat - dt * 0.35);
    }
  }
}

// How many police cars the current heat calls for.
export function policeWanted(stars) {
  if (stars <= 0) return 0;
  if (stars <= 2) return 2;
  if (stars === 3) return 3;
  return 4;
}

// Spawns one police car on a road near the player, facing the player.
export function spawnPolice(scene, rng, roadCentres, playerX, playerZ) {
  const road = rng.pick(roadCentres);
  const along = rng.chance(0.5);
  const dist = 55;
  const angle = rng.range(0, Math.PI * 2);
  let x = playerX + Math.cos(angle) * dist;
  let z = playerZ + Math.sin(angle) * dist;
  x = Math.max(-CFG.half + 5, Math.min(CFG.half - 5, x));
  z = Math.max(-CFG.half + 5, Math.min(CFG.half - 5, z));
  const car = makeCar('police', 0x20242a, x, z, Math.atan2(playerX - x, playerZ - z));
  car.speed = CFG.policeSpeed * 0.7;
  scene.add(car.mesh);
  return car;
}

// One police car, one step: steer at the player, ram when close, flash
// the light bar. Returns the distance to the player.
export function updatePoliceCar(car, dt, playerX, playerZ, playerSpeed, time) {
  const dx = playerX - car.x;
  const dz = playerZ - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-1, Math.min(1, diff * 1.6));
  car.heading += turn * 2.4 * dt;
  const target = dist > 26 ? CFG.policeSpeed : CFG.policeSpeed * 0.85;
  car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (let i = 0; i < car.wheels.length; i++) {
    car.wheels[i].rotation.x += (car.speed * dt) / 0.36;
  }
  // Alternate the light bar: red, then blue, every 0.35 seconds.
  if (car.lightBar) {
    const phase = Math.floor(time / 0.35) % 2 === 0;
    car.lightBar.red.emissiveIntensity = phase ? 2.4 : 0.15;
    car.lightBar.blue.emissiveIntensity = phase ? 0.15 : 2.4;
  }
  return dist;
}

// A soft push when a police car rams the player's car: the player's car
// is shoved along the police car's heading.
export function ramPlayer(playerCar, policeCar) {
  const push = 9;
  playerCar.x += Math.sin(policeCar.heading) * push * 0.016;
  playerCar.z += Math.cos(policeCar.heading) * push * 0.016;
  playerCar.speed *= 0.82;
}
