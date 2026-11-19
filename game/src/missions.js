// The four jobs: Hot Wheels, Dockside Drop, Heat Wave and the Solmar
// Sprint. The manager is a small state machine — each mission has phases,
// an objective line for the HUD, a beacon in the world, and a cash reward.
// It talks to the rest of the game through an event queue the main loop
// drains every frame.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf0c020, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 13;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xf0c020, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return { group, beam, ring };
}

export class MissionManager {
  constructor(scene, anchors) {
    this.anchors = anchors;
    this.beacon = makeBeacon(scene);
    this.events = [];
    this.cash = 0;
    this.index = 0;
    this.phase = 'steal';
    this.objective = '';
    this.marker = null;
    this.raceTimer = 0;
    this.checkpoint = 0;
    this.clearTimer = 0;
    this.gameComplete = false;
    this.startMission(0);
  }

  mission() {
    return MISSIONS[this.index];
  }

  startMission(i) {
    this.index = i;
    const m = MISSIONS[i];
    this.events.push({ kind: 'toast', text: m.intro });
    if (i === 0) {
      this.phase = 'steal';
      this.objective = m.steal;
      this.marker = this.anchors.showroom;
    } else if (i === 1) {
      this.phase = 'pickup';
      this.objective = m.pickup;
      this.marker = this.anchors.docks;
    } else if (i === 2) {
      this.phase = 'escape';
      this.objective = m.escape;
      this.marker = this.anchors.hideout;
      this.events.push({ kind: 'crime', heat: 3, reason: 'the whole city is looking for you' });
    } else if (i === 3) {
      this.phase = 'race';
      this.objective = m.race;
      this.raceTimer = 150;
      this.checkpoint = 0;
      this.marker = this.anchors.sprint[0];
    }
  }

  completeMission() {
    const m = MISSIONS[this.index];
    this.cash += m.reward;
    this.events.push({ kind: 'cash', amount: m.reward, text: m.done });
    this.events.push({ kind: 'sting' });
    if (this.index + 1 >= MISSIONS.length) {
      this.gameComplete = true;
      this.objective = 'CITY LEGEND — free roam Solmar as you like.';
      this.marker = null;
      this.events.push({ kind: 'complete', text: 'SOLMAR SPRINT COMPLETE — you are a City Legend.' });
    } else {
      this.startMission(this.index + 1);
    }
  }

  // ctx: {x, z, inCar, inTargetCar, wantedStars, nearestPolice, dt, time}
  update(ctx) {
    const m = this.mission();
    if (this.gameComplete) return;
    const distTo = (p) => Math.hypot(ctx.x - p.x, ctx.z - p.z);

    if (this.index === 0) {
      if (this.phase === 'steal' && ctx.inTargetCar) {
        this.phase = 'deliver';
        this.objective = m.deliver;
        this.marker = this.anchors.garage;
        this.events.push({ kind: 'crime', heat: 1, reason: 'car stolen — someone called it in' });
        this.events.push({ kind: 'toast', text: "That's the Comet GT. Get it to Delia's garage." });
      } else if (this.phase === 'deliver' && distTo(this.anchors.garage) < 9) {
        this.completeMission();
      }
    } else if (this.index === 1) {
      if (this.phase === 'pickup' && distTo(this.anchors.docks) < 9) {
        this.phase = 'deliver';
        this.objective = m.deliver;
        this.marker = this.anchors.warehouse;
        this.events.push({ kind: 'crime', heat: 1, reason: 'package lifted — harbour cops alerted' });
        this.events.push({ kind: 'toast', text: 'Package secured. The warehouse is across town.' });
      } else if (this.phase === 'deliver' && distTo(this.anchors.warehouse) < 9) {
        this.completeMission();
      }
    } else if (this.index === 2) {
      const atHideout = distTo(this.anchors.hideout) < 10;
      if (ctx.nearestPolice > 42) {
        this.clearTimer += ctx.dt;
      } else {
        this.clearTimer = 0;
      }
      if (atHideout && this.clearTimer > 5) {
        this.events.push({ kind: 'clear' });
        this.completeMission();
      }
    } else if (this.index === 3) {
      this.raceTimer -= ctx.dt;
      const cp = this.anchors.sprint[this.checkpoint];
      if (distTo(cp) < 10) {
        this.checkpoint += 1;
        this.events.push({ kind: 'toast', text: `Checkpoint ${this.checkpoint} of 6 — keep flying!` });
        this.events.push({ kind: 'blip' });
        if (this.checkpoint >= this.anchors.sprint.length) {
          this.completeMission();
          return;
        }
        this.marker = this.anchors.sprint[this.checkpoint];
      }
      if (this.raceTimer <= 0) {
        this.events.push({ kind: 'failed', text: 'Out of time. The sprint resets — try again.' });
        this.startMission(3);
      }
    }

    // Beacon follows the marker and pulses.
    if (this.marker) {
      this.beacon.group.visible = true;
      this.beacon.group.position.set(this.marker.x, 0, this.marker.z);
      const pulse = 1 + Math.sin(ctx.time * 3) * 0.12;
      this.beacon.ring.scale.set(pulse, pulse, 1);
      this.beacon.beam.material.opacity = 0.16 + Math.sin(ctx.time * 3) * 0.06;
    } else {
      this.beacon.group.visible = false;
    }
  }
}
