// Solmar City — Open-World Heist: the bootstrap and the game loop.
// Builds the renderer, the city, the cars, the crowd and the cops, then
// steps the whole simulation at a fixed 1/60s and chases the player with
// a smoothed third-person camera.

import * as THREE from 'three';
import { CFG, MISSIONS } from './config.js';
import { makeRng } from './random.js';
import { buildWorld } from './world.js';
import { makeCar, driveCar, createTraffic, updateTrafficCar } from './vehicles.js';
import { createPedestrians, updatePeds } from './people.js';
import { WantedSystem, policeWanted, spawnPolice, updatePoliceCar, ramPlayer } from './police.js';
import { MissionManager } from './missions.js';
import { SoundEngine } from './audio.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number.parseInt(params.get('seed') || '1', 10) || 1;
const rng = makeRng(SEED);

// --- renderer, scene, camera ---
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 1400);

const world = buildWorld(scene, rng);
const hud = new HUD();
const input = new Input();
const sound = new SoundEngine();
const wanted = new WantedSystem();
const missions = new MissionManager(scene, world.anchors);

// --- the player on foot ---
function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xc03028, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.05, 10), jacket);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b890, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.7 })
  );
  cap.position.y = 1.86;
  group.add(cap);
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.9 });
  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.17), dark);
    leg.position.set(x, 0.28, 0);
    group.add(leg);
  }
  return group;
}

const playerMesh = makePlayerMesh();
scene.add(playerMesh);
const player = { x: 84, z: -70, heading: Math.PI, speed: 0, inCar: false, car: null, walkPhase: 0 };

// --- cars: traffic, parked stealables, and the Comet GT ---
const traffic = createTraffic(scene, rng, world.roadCentres, 14);
const parked = [];
const parkedSpots = [
  { x: 28, z: -84, kind: 'sedan' },
  { x: -28, z: 84, kind: 'taxi' },
  { x: 140, z: 56, kind: 'sedan' },
  { x: -140, z: -56, kind: 'sports' },
  { x: 84, z: 28, kind: 'sedan' },
  { x: -84, z: -28, kind: 'taxi' },
  { x: 28, z: 140, kind: 'truck' },
  { x: -28, z: -140, kind: 'sedan' },
];
const parkedPaints = {
  sedan: [0xc0c8d0, 0x8090a0, 0x905050],
  taxi: [0xf0c020],
  sports: [0x20a0e0],
  truck: [0x708090],
};
for (const spot of parkedSpots) {
  const paints = parkedPaints[spot.kind];
  const car = makeCar(spot.kind, paints[Math.floor(rng.next() * paints.length)], spot.x, spot.z, rng.next() < 0.5 ? 0 : Math.PI / 2);
  car.owned = false;
  scene.add(car.mesh);
  parked.push(car);
}
const targetCar = makeCar('sports', 0xf0c020, world.anchors.showroom.x, world.anchors.showroom.z, Math.PI / 2);
targetCar.owned = false;
targetCar.isTarget = true;
scene.add(targetCar.mesh);
parked.push(targetCar);

const peds = createPedestrians(scene, rng, world.roadCentres, 22);
const police = [];

// --- game state ---
const game = {
  started: false,
  paused: false,
  busted: false,
  autoDrive: false,
  camLateral: 0,
  camFront: false,
  time: 0,
  bustedTimer: 0,
  crimeCooldown: 0,
  orbitYaw: 0,
  orbitPitch: 0,
  followYaw: player.heading,
  viewHeading: player.heading,
  shotCamera: null,
  player,
  traffic,
  police,
  parked,
  targetCar,
  missions,
  wanted,
  hud,
  sound,
  world,
};

// --- collision: a circle against the building AABBs ---
function collideCircle(obj, r) {
  let hit = false;
  for (const c of world.colliders) {
    const cx = Math.max(c.minX, Math.min(obj.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(obj.z, c.maxZ));
    const dx = obj.x - cx;
    const dz = obj.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 < 1e-8) {
        // Centre inside the box: leave by the nearest face.
        const pl = Math.min(obj.x - c.minX, c.maxX - obj.x);
        const pz = Math.min(obj.z - c.minZ, c.maxZ - obj.z);
        if (pl < pz) obj.x = obj.x - c.minX < c.maxX - obj.x ? c.minX - r : c.maxX + r;
        else obj.z = obj.z - c.minZ < c.maxZ - obj.z ? c.minZ - r : c.maxZ + r;
      } else {
        const d = Math.sqrt(d2);
        obj.x = cx + (dx / d) * r;
        obj.z = cz + (dz / d) * r;
      }
    }
  }
  if (obj.mesh) obj.mesh.position.set(obj.x, 0, obj.z);
  return hit;
}

function tryEnterCar() {
  let best = null;
  let bestD = CFG.interactRange;
  for (const car of parked) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return;
  player.inCar = true;
  player.car = best;
  playerMesh.visible = false;
  if (!best.owned) {
    best.owned = true;
    if (!best.isTarget) {
      wanted.addHeat(CFG.stealHeat);
      hud.toast('Car stolen — someone called it in.');
    }
  }
  sound.ensure();
  sound.resume();
}

function exitCar() {
  const car = player.car;
  car.speed = 0;
  const rx = -Math.cos(car.heading);
  const rz = Math.sin(car.heading);
  player.x = car.x + rx * 2.8;
  player.z = car.z + rz * 2.8;
  player.heading = car.heading;
  player.inCar = false;
  player.car = null;
  playerMesh.visible = true;
}

function doBusted() {
  game.busted = true;
  game.bustedTimer = 0;
  wanted.clear();
  for (const c of police.splice(0)) scene.remove(c.mesh);
  missions.cash = Math.max(0, missions.cash - 500);
  hud.setCash(missions.cash);
  if (player.inCar) {
    player.car.speed = 0;
    player.inCar = false;
    player.car = null;
    playerMesh.visible = true;
  }
  player.x = world.anchors.hideout.x;
  player.z = world.anchors.hideout.z;
  player.heading = 0;
  hud.showOverlay(
    'BUSTED',
    'The Solmar PD caught up with you.<br>$500 fine. Delia is not happy.',
    'BACK ON THE STREETS',
    () => {
      game.busted = false;
      hud.hideOverlay();
    }
  );
  sound.crash();
}

function drainEvents() {
  while (missions.events.length > 0) {
    const e = missions.events.shift();
    if (e.kind === 'toast') hud.toast(e.text);
    else if (e.kind === 'cash') {
      hud.setCash(missions.cash);
      hud.toast(`+$${e.amount.toLocaleString('en-US')} — ${e.text}`);
    } else if (e.kind === 'sting') sound.sting();
    else if (e.kind === 'blip') sound.blip();
    else if (e.kind === 'crime') {
      wanted.addHeat(e.heat);
      hud.toast(e.reason);
    } else if (e.kind === 'clear') wanted.clear();
    else if (e.kind === 'failed') hud.toast(e.text);
    else if (e.kind === 'complete') {
      hud.showOverlay(
        'CITY LEGEND',
        `${e.text}<br><br>Total take: $${missions.cash.toLocaleString('en-US')}.`,
        'KEEP EXPLORING',
        () => hud.hideOverlay()
      );
    }
  }
}

function updateCamera(dt) {
  if (game.shotCamera) {
    const s = game.shotCamera;
    camera.position.set(s.pos.x, s.pos.y, s.pos.z);
    camera.lookAt(s.target.x, s.target.y, s.target.z);
    game.viewHeading = Math.atan2(s.target.x - s.pos.x, s.target.z - s.pos.z);
    return;
  }
  if (!game.started) {
    // Title backdrop: a slow orbit over the whole city.
    const a = game.time * 0.045;
    camera.position.set(Math.sin(a) * 190, 85, Math.cos(a) * 190);
    camera.lookAt(0, 0, 0);
    game.viewHeading = Math.atan2(0 - camera.position.x, 0 - camera.position.z);
    return;
  }
  let targetYaw = player.heading + game.orbitYaw;
  let diff = targetYaw - game.followYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  game.followYaw += diff * Math.min(1, dt * 4);
  if (game.camFront) {
    // Front chase camera: ahead of the player looking back, so a pursuit
    // reads in frame — the player flees toward the lens, the police trail
    // behind them down the road.
    const fwd = { x: Math.sin(game.followYaw), z: Math.cos(game.followYaw) };
    const right = { x: -Math.cos(game.followYaw), z: Math.sin(game.followYaw) };
    const cx = player.x + fwd.x * 18 + right.x * 8;
    const cz = player.z + fwd.z * 18 + right.z * 8;
    const k = 1 - Math.exp(-dt * 6);
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (6 - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
    camera.lookAt(player.x + fwd.x * 4, 1.6, player.z + fwd.z * 4);
    game.viewHeading = Math.atan2(player.x + fwd.x * 4 - camera.position.x, player.z + fwd.z * 4 - camera.position.z);
    return;
  }
  const dist = player.inCar ? CFG.camDistance : 9;
  const height = player.inCar ? CFG.camHeight : 5.5;
  const cx = player.x - Math.sin(game.followYaw) * dist + -Math.cos(game.followYaw) * (game.camLateral || 0);
  const cz = player.z - Math.cos(game.followYaw) * dist + Math.sin(game.followYaw) * (game.camLateral || 0);
  const cy = height + game.orbitPitch * 8;
  const k = 1 - Math.exp(-dt * 6);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (cy - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(
    player.x + Math.sin(player.heading) * CFG.camLookAhead,
    1.6,
    player.z + Math.cos(player.heading) * CFG.camLookAhead
  );
  game.viewHeading = Math.atan2(
    player.x + Math.sin(player.heading) * 6 - camera.position.x,
    player.z + Math.cos(player.heading) * 6 - camera.position.z
  );
}

function updateHUD() {
  hud.setCash(missions.cash);
  hud.setStars(wanted.stars);
  hud.setObjective(
    missions.objective,
    missions.marker ? Math.hypot(missions.marker.x - player.x, missions.marker.z - player.z) : null
  );
  if (player.inCar && player.car) {
    hud.setSpeed(Math.abs(player.car.speed) * 3.6, player.car === targetCar ? 'COMET GT' : player.car.kind.toUpperCase());
  } else {
    hud.setSpeed(player.speed * 3.6, 'ON FOOT');
  }
  hud.setTimer(missions.index === 3 && !missions.gameComplete ? missions.raceTimer : null);
  if (missions.marker) {
    const angle = Math.atan2(missions.marker.x - player.x, missions.marker.z - player.z);
    hud.setArrow(angle, game.viewHeading);
  } else {
    hud.hideArrow();
  }
  hud.drawMinimap({ player, traffic, police, marker: missions.marker, time: game.time });
}

// One fixed simulation step. Called from the animation loop and, in shot
// mode, synchronously N times by shots.js.
function step(dt) {
  game.time += dt;
  game.crimeCooldown = Math.max(0, game.crimeCooldown - dt);

  if (input.consumePause()) {
    if (game.started && !game.busted) {
      game.paused = !game.paused;
      if (game.paused) {
        hud.showOverlay('PAUSED', 'Take a breath. Solmar waits.', 'RESUME', () => {
          game.paused = false;
          hud.hideOverlay();
        });
      } else {
        hud.hideOverlay();
      }
    }
  }
  if (input.consumeMute()) sound.setMuted(!sound.muted);
  const orbit = input.consumeOrbit();
  game.orbitYaw += orbit.dx * 0.005;
  game.orbitPitch = Math.max(-0.15, Math.min(0.45, game.orbitPitch + orbit.dy * 0.003));

  if (game.started && !game.paused && !game.busted) {
    // --- the player ---
    if (player.inCar && player.car) {
      // Shot staging can drive for the player (autoDrive): full throttle,
      // straight ahead, so a staged chase never coasts to a stop.
      const ctrl = game.autoDrive
        ? { throttle: 1, brake: 0, steer: 0, handbrake: false }
        : {
            throttle: Math.max(0, input.throttleAxis),
            brake: Math.max(0, -input.throttleAxis),
            steer: input.steerAxis,
            handbrake: input.handbrake,
          };
      driveCar(player.car, ctrl, dt);
      if (collideCircle(player.car, CFG.carRadius)) {
        player.car.speed *= 0.5;
        sound.crash();
      }
      player.car.x = Math.max(-160, Math.min(147, player.car.x));
      player.car.z = Math.max(-160, Math.min(160, player.car.z));
      player.car.mesh.position.set(player.car.x, 0, player.car.z);
      player.x = player.car.x;
      player.z = player.car.z;
      player.heading = player.car.heading;
    } else {
      const speed = input.running ? CFG.runSpeed : CFG.walkSpeed;
      const fwd = { x: Math.sin(game.viewHeading), z: Math.cos(game.viewHeading) };
      const right = { x: -Math.cos(game.viewHeading), z: Math.sin(game.viewHeading) };
      const mx = fwd.x * input.throttleAxis + right.x * input.steerAxis;
      const mz = fwd.z * input.throttleAxis + right.z * input.steerAxis;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        player.speed = speed;
        player.x += (mx / len) * speed * dt;
        player.z += (mz / len) * speed * dt;
        player.heading = Math.atan2(mx, mz);
        player.walkPhase += dt * speed * 1.6;
      } else {
        player.speed = 0;
      }
      collideCircle(player, 0.7);
      player.x = Math.max(-160, Math.min(192, player.x));
      player.z = Math.max(-160, Math.min(160, player.z));
      playerMesh.position.set(player.x, Math.abs(Math.sin(player.walkPhase)) * 0.05, player.z);
      playerMesh.rotation.y = player.heading;
    }
    if (input.consumeInteract()) {
      if (player.inCar) exitCar();
      else tryEnterCar();
    }

    // --- the living city ---
    for (const car of traffic) updateTrafficCar(car, dt);
    updatePeds(
      peds,
      dt,
      player.inCar
        ? { x: player.x, z: player.z, speed: Math.abs(player.car.speed) }
        : { x: player.x, z: player.z, speed: player.speed },
      rng
    );

    // --- police: match the wanted level, chase, ram, bust ---
    const want = policeWanted(wanted.stars);
    while (police.length < want) {
      police.push(spawnPolice(scene, rng, world.roadCentres, player.x, player.z));
    }
    while (police.length > want) {
      const c = police.pop();
      scene.remove(c.mesh);
    }
    let nearestPolice = 999;
    for (const c of police) {
      const d = updatePoliceCar(c, dt, player.x, player.z, player.inCar ? player.car.speed : player.speed, game.time);
      nearestPolice = Math.min(nearestPolice, d);
      if (collideCircle(c, CFG.carRadius)) c.speed *= 0.8;
      if (player.inCar && d < 4.4) {
        // Ram, then separate: the two cars must never interpenetrate.
        ramPlayer(player.car, c);
        const dx = player.car.x - c.x;
        const dz = player.car.z - c.z;
        const dd = Math.hypot(dx, dz);
        if (dd > 0.01 && dd < 4.3) {
          const push = (4.3 - dd) / 2;
          player.car.x += (dx / dd) * push;
          player.car.z += (dz / dd) * push;
          c.x -= (dx / dd) * push;
          c.z -= (dz / dd) * push;
          player.car.mesh.position.set(player.car.x, 0, player.car.z);
          c.mesh.position.set(c.x, 0, c.z);
        }
        if (Math.abs(player.car.speed) < 3) game.bustedTimer += dt;
        else game.bustedTimer = 0;
      }
    }
    if (!player.inCar || nearestPolice > 6) game.bustedTimer = 0;
    wanted.update(dt, nearestPolice);

    // --- bumps, scrapes and hit pedestrians are crimes ---
    if (player.inCar) {
      for (const car of traffic) {
        const dx = car.x - player.x;
        const dz = car.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.3 && d > 0.01) {
          const push = (4.3 - d) / 2;
          car.x += (dx / d) * push;
          car.z += (dz / d) * push;
          player.car.x -= (dx / d) * push;
          player.car.z -= (dz / d) * push;
          player.car.speed *= 0.85;
          if (game.crimeCooldown <= 0) {
            game.crimeCooldown = 1.2;
            wanted.addHeat(CFG.hitCarHeat);
            sound.crash();
            hud.toast('You clipped a car — someone saw that.');
          }
        }
      }
      for (const p of peds) {
        const d = Math.hypot(p.x - player.x, p.z - player.z);
        if (d < 2.4 && Math.abs(player.car.speed) > 4) {
          p.fleeTimer = 2;
          if (game.crimeCooldown <= 0) {
            game.crimeCooldown = 1.5;
            wanted.addHeat(CFG.hitPedHeat);
            sound.crash();
            hud.toast('Pedestrian hit! The cops are coming.');
          }
        }
      }
    }

    missions.update({
      x: player.x,
      z: player.z,
      inCar: player.inCar,
      inTargetCar: player.car === targetCar,
      wantedStars: wanted.stars,
      nearestPolice,
      dt,
      time: game.time,
    });
    drainEvents();
    if (game.bustedTimer > CFG.bustedHoldSeconds) doBusted();
    sound.update(
      player.inCar ? Math.abs(player.car.speed) / CFG.carMaxSpeed : player.speed / CFG.runSpeed,
      player.inCar ? Math.max(0, input.throttleAxis) : 0,
      wanted.stars
    );
  } else if (!game.started) {
    // Attract mode behind the title: the city keeps moving.
    for (const car of traffic) updateTrafficCar(car, dt);
    updatePeds(peds, dt, null, rng);
  }

  updateCamera(dt);
  updateHUD();
}

function render() {
  renderer.render(scene, camera);
}

// --- helpers the shot stager uses ---
game.setWanted = (n) => {
  wanted.heat = n;
};
game.spawnPoliceAt = (x, z, heading) => {
  const c = makeCar('police', 0x20242a, x, z, heading);
  c.speed = CFG.policeSpeed * 0.8;
  scene.add(c.mesh);
  police.push(c);
  return c;
};
game.teleportPlayer = (x, z, heading) => {
  if (player.inCar && player.car) {
    player.car.speed = 0;
    player.inCar = false;
    player.car = null;
  }
  player.x = x;
  player.z = z;
  player.heading = heading;
  player.speed = 0;
  playerMesh.visible = true;
  playerMesh.position.set(x, 0, z);
  playerMesh.rotation.y = heading;
};
game.enterCarForced = (car) => {
  player.inCar = true;
  player.car = car;
  car.owned = true;
  playerMesh.visible = false;
};
game.setCameraFixed = (pos, target) => {
  game.shotCamera = { pos, target };
};
game.step = step;
game.render = render;

// --- go ---
function startGame() {
  game.started = true;
  hud.hideOverlay();
  sound.ensure();
  sound.resume();
}

camera.position.set(player.x - Math.sin(player.heading) * 13, 7.5, player.z - Math.cos(player.heading) * 13);
camera.lookAt(player.x, 1.6, player.z);
render();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (SHOT) {
  applyShot(game, SHOT);
} else {
  hud.showStart(MISSIONS);
  hud.onOverlayButton = startGame;
  const clock = new THREE.Clock();
  const loop = () => {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    render();
  };
  loop();
}
