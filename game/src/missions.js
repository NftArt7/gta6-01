// Solmar City — four story missions, played in order, each with a world
// marker, a minimap blip and a cash reward. Free roam continues after the
// last one, and the end screen shows the total take.
import * as THREE from '../vendor/three.module.min.js';
import { dist2D } from './util.js';

const REWARDS = [500, 750, 1000, 1500];
const NAMES = ['Hot Wheels', 'Dockside Drop', 'Heat Wave', 'Solmar Sprint'];

export function createMissions(G) {
  // World marker: a glowing beacon column + a pulsing ground ring.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  G.scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  G.scene.add(ring);

  const gates = [];
  const gateMat = new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const gate = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 10, 24), gateMat);
    gate.visible = false;
    G.scene.add(gate);
    gates.push(gate);
  }
  const GATE_SPOTS = [
    { x: 0, z: -116 }, { x: 116, z: -58 }, { x: 116, z: 116 },
    { x: -58, z: 174 }, { x: -174, z: 0 },
  ];

  const M = {
    index: 0,
    done: false,
    hasPackage: false,
    phase: 'drive', // mission-specific phase
    timer: 0,
    gateIndex: 0,
    blip: null, // {x, z, color} drawn on the minimap
    objective: '',
    setMarker(x, z, color = 0xffd23c) {
      beacon.visible = true;
      ring.visible = true;
      beacon.position.set(x, 30, z);
      ring.position.set(x, 0.15, z);
      beacon.material.color.setHex(color);
      ring.material.color.setHex(color);
      M.blip = { x, z, color: '#' + color.toString(16).padStart(6, '0') };
    },
    hideMarker() {
      beacon.visible = false;
      ring.visible = false;
      M.blip = null;
      for (const g of gates) g.visible = false;
    },
    start(i) {
      M.index = i;
      M.done = false;
      M.hasPackage = false;
      M.gateIndex = 0;
      if (i === 0) {
        M.phase = 'steal';
        M.objective = 'Mission 1 — Hot Wheels: steal a car (walk up to one, press E), then drive it to the Paint Shop.';
        M.setMarker(G.city.paintShop.x, G.city.paintShop.z + 14);
      } else if (i === 1) {
        M.phase = 'pickup';
        M.objective = 'Mission 2 — Dockside Drop: on foot, grab the package at the Solmar Docks (press E), then deliver it.';
        M.setMarker(G.city.docks.x, G.city.docks.z);
      } else if (i === 2) {
        M.phase = 'evade';
        G.setWanted(2);
        M.objective = 'Mission 3 — Heat Wave: you have 2 stars! Lose the cops — stay out of sight until the heat dies down.';
        M.hideMarker();
      } else if (i === 3) {
        M.phase = 'race';
        M.timer = 100;
        M.objective = 'Mission 4 — Solmar Sprint: drive through all 5 green gates before the clock runs out!';
        M.showGate();
      }
      G.hud.setObjective(M.objective);
      G.hud.toast(`Mission ${i + 1}: ${NAMES[i]} — $${REWARDS[i]}`);
      G.audio.blip();
    },
    showGate() {
      const spot = GATE_SPOTS[M.gateIndex];
      for (const g of gates) g.visible = false;
      const gate = gates[M.gateIndex];
      gate.visible = true;
      gate.position.set(spot.x, 4.2, spot.z);
      gate.rotation.y = Math.PI / 2;
      M.setMarker(spot.x, spot.z, 0x39ff88);
    },
    complete() {
      const reward = REWARDS[M.index];
      G.addMoney(reward);
      G.audio.chime();
      G.hud.toast(`Mission complete: ${NAMES[M.index]} — +$${reward}`);
      M.hideMarker();
      if (M.index + 1 < 4) {
        M.start(M.index + 1);
      } else {
        M.done = true;
        G.onAllMissionsDone();
      }
    },
    update(dt) {
      if (M.done || G.state !== 'playing') return;
      const pos = G.playerPos();
      // pulse the ring
      const s = 1 + Math.sin(performance.now() / 300) * 0.12;
      ring.scale.set(s, s, 1);
      if (M.index === 0) {
        if (M.phase === 'steal' && pos.driving) {
          M.phase = 'drive';
          M.objective = 'Mission 1 — Hot Wheels: now drive the stolen car to the Paint Shop marker.';
          G.hud.setObjective(M.objective);
        }
        if (M.phase === 'drive' && pos.driving
          && dist2D(pos.x, pos.z, G.city.paintShop.x, G.city.paintShop.z + 14) < 9) {
          M.complete();
        }
      } else if (M.index === 1) {
        if (M.phase === 'pickup') {
          if (!pos.driving && dist2D(pos.x, pos.z, G.city.docks.x, G.city.docks.z) < 6) {
            G.hud.setObjective('Mission 2 — Dockside Drop: package in reach — press E to grab it.');
            if (G.input.wasPressed('KeyE')) {
              M.hasPackage = true;
              M.phase = 'deliver';
              G.audio.coin();
              M.objective = 'Mission 2 — Dockside Drop: package secured! Deliver it to the marked door uptown.';
              G.hud.setObjective(M.objective);
              M.setMarker(G.city.delivery.x, G.city.delivery.z);
            }
          }
        } else if (!pos.driving && dist2D(pos.x, pos.z, G.city.delivery.x, G.city.delivery.z) < 6) {
          M.complete();
        }
      } else if (M.index === 2) {
        if (G.wanted <= 0) M.complete();
      } else if (M.index === 3) {
        M.timer -= dt;
        G.hud.setObjective(`Mission 4 — Solmar Sprint: gate ${M.gateIndex + 1}/5 — ${Math.max(0, Math.ceil(M.timer))}s left!`);
        if (M.timer <= 0) {
          G.hud.toast('Too slow! The sprint restarts — get back to gate 1.');
          G.audio.thud();
          M.timer = 100;
          M.gateIndex = 0;
          M.showGate();
          return;
        }
        const spot = GATE_SPOTS[M.gateIndex];
        if (dist2D(pos.x, pos.z, spot.x, spot.z) < 6) {
          G.audio.coin();
          M.gateIndex++;
          if (M.gateIndex >= 5) M.complete();
          else M.showGate();
        }
      }
    },
  };
  return M;
}
