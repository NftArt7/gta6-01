// The HUD: cash and wanted stars, the mission objective, speed, a live
// minimap, toasts, the direction arrow, and the full-screen overlays
// (start screen, pause, busted, mission complete). All DOM lives in
// index.html; this file only drives it.

import { CFG } from './config.js';

export class HUD {
  constructor() {
    this.cashEl = document.getElementById('cash');
    this.starsEl = document.getElementById('stars');
    this.objectiveEl = document.getElementById('objective-text');
    this.objDistEl = document.getElementById('obj-dist');
    this.speedEl = document.getElementById('speed-value');
    this.speedLabelEl = document.getElementById('speed-label');
    this.timerEl = document.getElementById('timer');
    this.toastEl = document.getElementById('toast');
    this.arrowEl = document.getElementById('arrow');
    this.overlayEl = document.getElementById('overlay');
    this.overlayTitleEl = document.getElementById('overlay-title');
    this.overlayTextEl = document.getElementById('overlay-text');
    this.overlayBtnEl = document.getElementById('overlay-btn');
    this.mapEl = document.getElementById('minimap');
    this.mapCtx = this.mapEl.getContext('2d');
    this.toastTimer = null;
    this.onOverlayButton = null;
    this.overlayBtnEl.addEventListener('click', () => {
      if (this.onOverlayButton) this.onOverlayButton();
    });
  }

  setCash(cash) {
    this.cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
  }

  setStars(n) {
    let out = '';
    for (let i = 0; i < 5; i++) {
      out += `<span class="star${i < n ? ' on' : ''}">★</span>`;
    }
    this.starsEl.innerHTML = out;
  }

  setObjective(text, distM) {
    this.objectiveEl.textContent = text;
    this.objDistEl.textContent = distM === null ? '' : `${Math.round(distM)}m`;
  }

  setSpeed(kmh, label) {
    this.speedEl.textContent = `${Math.round(kmh)}`;
    this.speedLabelEl.textContent = label;
  }

  setTimer(seconds) {
    if (seconds === null) {
      this.timerEl.textContent = '';
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
    this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', s <= 30);
  }

  toast(text, ms = 4200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  // Points the arrow at the objective, relative to the camera heading.
  setArrow(angleToTarget, cameraHeading) {
    const rel = angleToTarget - cameraHeading;
    this.arrowEl.style.transform = `translate(-50%, -50%) rotate(${rel}rad)`;
    this.arrowEl.style.opacity = '1';
  }

  hideArrow() {
    this.arrowEl.style.opacity = '0';
  }

  showOverlay(title, text, buttonText, onButton) {
    this.overlayTitleEl.textContent = title;
    this.overlayTextEl.innerHTML = text;
    this.overlayBtnEl.textContent = buttonText;
    this.overlayBtnEl.style.display = buttonText ? '' : 'none';
    this.onOverlayButton = onButton;
    this.overlayEl.classList.add('show');
  }

  hideOverlay() {
    this.overlayEl.classList.remove('show');
    this.onOverlayButton = null;
  }

  showStart(missions) {
    const list = missions.map((m) => `<li><b>${m.name}</b> — $${m.reward.toLocaleString('en-US')}</li>`).join('');
    this.showOverlay(
      'SOLMAR CITY',
      `An open-world heist in the sun. You are <b>Rex Marlowe</b>, getaway driver for the fixer Delia Voss.<br><br>
       <ul>${list}</ul>
       <p class="controls">WASD drive &amp; walk · E steal / enter car · Space handbrake · Mouse drag orbits the camera · M mute · P pause</p>`,
      'START THE FIRST JOB',
      null
    );
  }

  // Top-down map: roads, water, the player, traffic, police and the
  // mission marker. `state` carries everything drawn, in world units.
  drawMinimap(state) {
    const S = 150;
    const ctx = this.mapCtx;
    const scale = S / (CFG.half * 2 + 40);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 18, 24, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Water on the east edge.
    ctx.fillStyle = 'rgba(42, 122, 154, 0.9)';
    const [wx] = toMap(CFG.half, 0);
    ctx.fillRect(wx, 0, S - wx, S);
    // Roads.
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.85)';
    ctx.lineWidth = 2;
    for (const c of CFG.roadCentres()) {
      const [x1] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, S);
      ctx.stroke();
      const [, z1] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, z1);
      ctx.lineTo(S, z1);
      ctx.stroke();
    }
    const dot = (x, z, r, color) => {
      const [px, py] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Mission marker, pulsing.
    if (state.marker) {
      const pulse = 3 + Math.sin(state.time * 4) * 1.2;
      dot(state.marker.x, state.marker.z, pulse, '#f0c020');
      ctx.strokeStyle = '#f0c020';
      ctx.lineWidth = 1.5;
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      ctx.beginPath();
      ctx.arc(mx, my, pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const car of state.traffic) dot(car.x, car.z, 1.6, 'rgba(255,255,255,0.8)');
    for (const car of state.police) dot(car.x, car.z, 2.2, '#ff4040');
    // Player arrow, rotated to the heading.
    const [px, py] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#40e080';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
