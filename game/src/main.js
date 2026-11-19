// Solmar City — an original open-world crime game in the browser.
// Drive and walk a procedural city, steal cars, outrun the police, run four
// story missions, and watch the sun set over the beach. Three.js is vendored
// under game/vendor/; everything else in game/src/ is written for this game.
import * as THREE from '../vendor/three.module.min.js';
import { buildCity, collide } from './city.js';
import { createPlayerCar, createTraffic, createPolice } from './vehicles.js';
import { createCrowd, createPlayerOnFoot } from './people.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { applyShot } from './shots.js';
import { clamp, dist2D } from './util.js';

const SAVE_KEY = 'solmar-city-save-v1';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fc3e0, 180, 620);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a6a4a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1c4, 1.6);
sun.position.set(-180, 260, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -220;
sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;
sun.shadow.camera.far = 800;
scene.add(sun);

const city = buildCity();
scene.add(city.group);

const audio = createAudio();
const input = createInput();
const car = createPlayerCar(scene);
const traffic = createTraffic(scene, city, 10);
const police = createPolice(scene, city);
const crowd = createCrowd(scene, city, 16);
const onFoot = createPlayerOnFoot(scene);

const G = {
  scene, camera, renderer, city, car, onFoot, traffic, police, crowd,
  missions: null, hud: null, audio, input,
  state: 'menu',
  money: 0,
  health: 100,
  wanted: 0,
  driving: false,
  camMode: 'chase',
  camYaw: 0,
  camPitch: 0.28,
  camDist: 13,
  autoDrive: false, // screenshot setups hold the accelerator down
  playTime: 0,
  clockMin: 12 * 60,
  wantedDecay: 0,
  ramCooldown: 0,
  saveTimer: 0,
  playerPos() {
    if (this.driving) return { x: car.x, z: car.z, driving: true };
    return { x: onFoot.x, z: onFoot.z, driving: false };
  },
  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, 3);
    police.setWanted(this.wanted);
    this.hud.setWanted(this.wanted);
    audio.siren(this.wanted > 0);
    this.wantedDecay = 0;
  },
  addMoney(n) {
    this.money += n;
    this.hud.setMoney(this.money);
    this.save();
  },
  onAllMissionsDone() {
    this.state = 'complete';
    this.save();
    localStorage.removeItem(SAVE_KEY);
    this.hud.showScreen('complete', { money: this.money, time: fmtTime(this.playTime) });
  },
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money, mission: this.missions.index, health: this.health,
      }));
    } catch { /* storage unavailable: the game still runs */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
};

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const hud = createHUD({
  onStart() { startGame(null); },
  onContinue() { startGame(G.load()); },
  onResume() {
    G.state = 'playing';
    hud.showScreen(null);
  },
  onRestart() { startGame(null); },
  onFreeRoam() {
    G.state = 'playing';
    hud.showScreen(null);
    hud.setObjective('Free roam — Solmar City is yours. Steal cars, dodge the law, have fun.');
  },
});
G.hud = hud;
G.missions = createMissions(G);

function startGame(save) {
  audio.unlock();
  G.money = save ? save.money : 0;
  G.health = save ? save.health : 100;
  G.playTime = 0;
  G.clockMin = 12 * 60;
  G.driving = false;
  G.autoDrive = false;
  G.setWanted(0);
  hud.setMoney(G.money);
  hud.setHealth(G.health);
  hud.setWanted(0);
  hud.showScreen(null);
  onFoot.setPose(city.spawn.x, city.spawn.z, Math.PI);
  onFoot.mesh.group.visible = true;
  car.setPose(city.spawn.x + 5, city.spawn.z + 3, Math.PI / 2);
  car.active = true;
  car.mesh.group.visible = true;
  G.state = 'playing';
  G.camMode = 'chase';
  G.camYaw = Math.PI;
  G.missions.start(save ? Math.min(save.mission, 3) : 0);
  hud.toast('Welcome to Solmar City — steal a car to begin.');
  renderer.domElement.requestPointerLock?.();
}

function enterCar(stolen) {
  G.driving = true;
  onFoot.mesh.group.visible = false;
  audio.blip();
  if (stolen) {
    G.setWanted(G.wanted + 1);
    hud.toast('Car stolen! The law is watching — +1 star.');
  } else {
    hud.toast('Behind the wheel.');
  }
}

function exitCar() {
  G.driving = false;
  car.speed = 0;
  // step out on the passenger side of the car
  const fixed = collide(city, car.x + Math.cos(car.heading) * 2.6, car.z - Math.sin(car.heading) * 2.6, 0.55);
  onFoot.setPose(fixed.x, fixed.z, car.heading);
  onFoot.mesh.group.visible = true;
  audio.blip();
}

function damage(amount) {
  if (G.state !== 'playing') return;
  G.health = Math.max(0, G.health - amount);
  hud.setHealth(G.health);
  if (G.health <= 0) {
    G.state = 'gameover';
    audio.wasted();
    audio.engine(0, false);
    audio.siren(false);
    hud.showScreen('gameover', { money: G.money });
  }
}

// --- camera ---
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (G.camMode === 'cinematic') return; // shots place the camera themselves
  const pos = G.playerPos();
  const heading = G.driving ? car.heading : onFoot.heading;
  // chase camera: yaw follows the player heading, mouse drag orbits
  const mouse = input.takeMouse();
  G.camYaw -= mouse.dx * 0.0032;
  G.camPitch = clamp(G.camPitch + mouse.dy * 0.0022, 0.08, 0.9);
  const targetYaw = G.driving ? car.heading + Math.PI : heading + Math.PI;
  // ease the camera yaw toward behind-the-player
  let dy = ((targetYaw - G.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  G.camYaw += dy * Math.min(1, dt * (G.driving ? 2.2 : 3.2));
  const dist = G.driving ? 13 : 9;
  const h = G.driving ? 5.2 : 4.2;
  const cx = pos.x + Math.sin(G.camYaw) * dist;
  const cz = pos.z + Math.cos(G.camYaw) * dist;
  camera.position.set(cx, h + Math.sin(G.camPitch) * 6, cz);
  camTarget.set(pos.x, G.driving ? 2.2 : 1.8, pos.z);
  camera.lookAt(camTarget);
}

// --- main loop ---
const clock = new THREE.Clock();
let shotApplied = false;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && !shotApplied) {
    shotApplied = true;
    applyShot(G, shot);
  }

  // pause toggle
  if (input.wasPressed('KeyP') && (G.state === 'playing' || G.state === 'paused')) {
    if (G.state === 'playing') {
      G.state = 'paused';
      hud.showScreen('pause', { money: G.money, mission: G.missions.index + 1, health: Math.round(G.health) });
    } else {
      G.state = 'playing';
      hud.showScreen(null);
    }
  }
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }
  if (input.wasPressed('Enter') && G.state === 'menu') startGame(null);

  if (G.state === 'playing') {
    G.playTime += dt;
    G.clockMin = (G.clockMin + dt * 0.5) % (24 * 60);
    hud.setClock(Math.floor(G.clockMin / 60), Math.floor(G.clockMin % 60));
    hud.setSpeed(G.driving ? Math.abs(car.speed) * 3.6 : 0);

    // enter / exit car
    if (input.wasPressed('KeyE')) {
      if (G.driving) {
        exitCar();
      } else {
        const nearOwn = dist2D(onFoot.x, onFoot.z, car.x, car.z) < 4.5;
        const stolen = traffic.nearest(onFoot.x, onFoot.z, 5);
        if (nearOwn) {
          enterCar(false);
        } else if (stolen) {
          // steal the traffic car: it becomes the player's car
          const cx = stolen.horizontal ? stolen.t : stolen.line + stolen.lane;
          const cz = stolen.horizontal ? stolen.line + stolen.lane : stolen.t;
          traffic.remove(stolen);
          scene.remove(stolen.mesh.group);
          car.mesh.group.children[0].material.color.setHex(0xd94f4f);
          car.setPose(cx, cz, stolen.heading);
          car.speed = 0;
          enterCar(true);
          setTimeout(() => traffic.respawn(scene, city, G.playerPos()), 4000);
        }
      }
    }
    // punch on foot
    if (input.wasPressed('KeyF') && !G.driving) {
      onFoot.punchTimer = 0.35;
      if (crowd.punch(onFoot.x, onFoot.z, onFoot.heading)) {
        audio.thud();
        G.setWanted(G.wanted + 1);
        hud.toast('You decked a pedestrian! +1 star.');
      }
    }

    if (G.driving) {
      // Screenshot setups hold the accelerator so the chase reads as a chase.
      const driveInput = G.autoDrive
        ? { axis: () => ({ x: 0, y: 1 }), isDown: () => false, wasPressed: () => false }
        : input;
      car.update(dt, driveInput, city, audio);
    } else {
      onFoot.update(dt, input, city, G.camYaw + Math.PI);
      audio.engine(0, false);
    }

    // wanted decay: hide from the cops and the heat dies down
    if (G.wanted > 0) {
      let nearestCop = Infinity;
      for (const c of police.cruisers) nearestCop = Math.min(nearestCop, dist2D(c.x, c.z, G.playerPos().x, G.playerPos().z));
      if (nearestCop > 45) {
        G.wantedDecay += dt;
        if (G.wantedDecay > 12) {
          G.setWanted(G.wanted - 1);
          hud.toast(G.wanted > 0 ? 'Heat dropping… one star gone.' : 'You lost them. Clean.');
        }
      } else {
        G.wantedDecay = 0;
      }
    }
    if (G.wanted === 0 && G.health < 100) {
      G.health = Math.min(100, G.health + dt * 1.5);
      hud.setHealth(G.health);
    }
    if (G.ramCooldown > 0) G.ramCooldown -= dt;

    police.update(dt, G.playerPos(), G.driving ? car.speed : 0, () => {
      if (G.ramCooldown <= 0) {
        G.ramCooldown = 1.1;
        audio.crash();
        damage(8);
        hud.toast('Police rammed you! -8 health.');
        if (G.driving) car.speed *= 0.5;
      }
    });

    G.missions.update(dt);
    G.saveTimer += dt;
    if (G.saveTimer > 15) {
      G.saveTimer = 0;
      G.save();
    }
  }

  // ambient life runs in every state so the menu shows a living city
  traffic.update(dt, G.state === 'playing' ? G.playerPos() : null);
  crowd.update(dt, G.playerPos(), audio);
  audio.update(dt);
  updateCamera(dt);
  hud.drawMinimap(G);
  input.endFrame();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// boot: menu over the living city
{
  const save = G.load();
  onFoot.setPose(city.spawn.x, city.spawn.z, Math.PI);
  car.setPose(city.spawn.x + 5, city.spawn.z + 3, Math.PI / 2);
  car.active = true;
  hud.setMoney(0);
  hud.setHealth(100);
  hud.setWanted(0);
  hud.setObjective('Steal a car, run the jobs, own Solmar City.');
  hud.showScreen('menu', { hasSave: !!save });
  hud.setClock(12, 0);
  G.camMode = 'cinematic';
  camera.position.set(city.spawn.x - 14, 9, city.spawn.z + 22);
  camera.lookAt(city.spawn.x, 6, city.spawn.z - 60);
  // drift the menu camera slowly for a living title screen
  const menuDrift = setInterval(() => {
    if (G.state !== 'menu' || G.camMode !== 'cinematic') return;
    const t = performance.now() / 1000;
    camera.position.set(
      city.spawn.x - 14 + Math.sin(t * 0.08) * 10,
      9 + Math.sin(t * 0.05) * 1.5,
      city.spawn.z + 22 + Math.cos(t * 0.06) * 6,
    );
    camera.lookAt(city.spawn.x, 6, city.spawn.z - 60);
  }, 50);
  void menuDrift;
}

frame();
