// Solmar City — HUD: money, health, wanted stars, objective, speed, clock,
// a 2D minimap, and the menu / pause / mission-complete / game-over screens.
// All DOM is built here so index.html stays a thin shell.
export function createHUD(callbacks) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="hud-money">$0</div>
      <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-text">100</span></div>
      <div id="hud-objective"></div>
    </div>
    <div id="hud-top-right">
      <div id="hud-stars"></div>
      <canvas id="hud-minimap" width="180" height="180"></canvas>
      <div id="hud-clock">12:00</div>
    </div>
    <div id="hud-bottom-right"><span id="hud-speed">0</span> <small>km/h</small></div>
    <div id="hud-toast"></div>
    <div id="hud-screen"></div>
  `;
  const moneyEl = document.getElementById('hud-money');
  const healthFill = document.getElementById('hud-health-fill');
  const healthText = document.getElementById('hud-health-text');
  const objectiveEl = document.getElementById('hud-objective');
  const starsEl = document.getElementById('hud-stars');
  const clockEl = document.getElementById('hud-clock');
  const speedEl = document.getElementById('hud-speed');
  const toastEl = document.getElementById('hud-toast');
  const screenEl = document.getElementById('hud-screen');
  const mapCanvas = document.getElementById('hud-minimap');
  const mapCtx = mapCanvas.getContext('2d');
  let toastTimer = null;

  function starRow(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="star${i < n ? ' on' : ''}">★</span>`;
    return s;
  }

  const H = {
    setMoney(v) { moneyEl.textContent = '$' + v.toLocaleString('en-US'); },
    setHealth(v) {
      const pct = Math.max(0, Math.min(100, v));
      healthFill.style.width = pct + '%';
      healthFill.style.background = pct > 50 ? '#58b368' : pct > 25 ? '#e8a13c' : '#d9534f';
      healthText.textContent = Math.round(pct);
    },
    setWanted(n) { starsEl.innerHTML = starRow(n); },
    setObjective(text) { objectiveEl.textContent = text; },
    setSpeed(kmh) { speedEl.textContent = Math.round(kmh); },
    setClock(h, m) {
      clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3600);
    },
    // Minimap: city blocks as grey squares, roads, blips for the player
    // (white), traffic (yellow), police (blue/red), mission target (gold).
    drawMinimap(G) {
      const W = 180;
      const Hh = 180;
      const half = G.city.half + 40;
      const toMap = (x, z) => [
        ((x + half) / (half * 2)) * W,
        ((z + half) / (half * 2)) * Hh,
      ];
      mapCtx.fillStyle = 'rgba(10,14,20,0.82)';
      mapCtx.fillRect(0, 0, W, Hh);
      mapCtx.fillStyle = '#3d4450';
      for (let bx = -3; bx <= 3; bx++) {
        for (let bz = -3; bz <= 3; bz++) {
          const [x, y] = toMap(bx * G.city.pitch - 20, bz * G.city.pitch - 20);
          mapCtx.fillRect(x, y, 9, 9);
        }
      }
      // beach + ocean strip
      mapCtx.fillStyle = '#c9b078';
      mapCtx.fillRect(0, toMap(0, G.city.beachZ)[1], W, 8);
      mapCtx.fillStyle = '#1d6f9e';
      mapCtx.fillRect(0, toMap(0, G.city.oceanZ)[1], W, Hh);
      const dot = (x, z, color, r = 3) => {
        const [px, py] = toMap(x, z);
        mapCtx.fillStyle = color;
        mapCtx.beginPath();
        mapCtx.arc(px, py, r, 0, Math.PI * 2);
        mapCtx.fill();
      };
      if (G.missions.blip) dot(G.missions.blip.x, G.missions.blip.z, G.missions.blip.color, 5);
      for (const c of G.traffic.cars) {
        const x = c.horizontal ? c.t : c.line + c.lane;
        const z = c.horizontal ? c.line + c.lane : c.t;
        dot(x, z, '#e8c13c', 2);
      }
      for (const p of G.police.cruisers) dot(p.x, p.z, '#4f7ad9', 3);
      const pos = G.playerPos();
      dot(pos.x, pos.z, '#ffffff', 4);
      // north tick
      mapCtx.fillStyle = '#fff';
      mapCtx.font = 'bold 11px sans-serif';
      mapCtx.fillText('N', W / 2 - 4, 12);
    },
    showScreen(name, data = {}) {
      if (name === 'menu') {
        screenEl.innerHTML = `
          <div class="panel">
            <h1>SOLMAR CITY</h1>
            <p class="tag">An open-world heist in the sun — steal cars, dodge the law,<br>run four jobs and own the city.</p>
            <div class="controls">
              <b>WASD</b> drive / walk &nbsp;·&nbsp; <b>E</b> enter &amp; exit car &nbsp;·&nbsp; <b>F</b> punch<br>
              <b>Space</b> handbrake &nbsp;·&nbsp; <b>Shift</b> sprint &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute
            </div>
            <button id="btn-start">▶ &nbsp;NEW GAME</button>
            ${data.hasSave ? '<button id="btn-continue">↻ &nbsp;CONTINUE</button>' : ''}
            <p class="fine">Original game — Solmar City, its people and its story are invented here.<br>Best played full-screen in a desktop browser.</p>
          </div>`;
        document.getElementById('btn-start').onclick = () => callbacks.onStart();
        const cont = document.getElementById('btn-continue');
        if (cont) cont.onclick = () => callbacks.onContinue();
      } else if (name === 'pause') {
        screenEl.innerHTML = `
          <div class="panel">
            <h1>PAUSED</h1>
            <p class="tag">Solmar City waits for no one — except right now.</p>
            <button id="btn-resume">▶ &nbsp;RESUME</button>
            <button id="btn-restart">↻ &nbsp;RESTART</button>
            <p class="fine">Money $${data.money} · Mission ${data.mission}/4 · Health ${data.health}</p>
          </div>`;
        document.getElementById('btn-resume').onclick = () => callbacks.onResume();
        document.getElementById('btn-restart').onclick = () => callbacks.onRestart();
      } else if (name === 'complete') {
        screenEl.innerHTML = `
          <div class="panel">
            <h1>SOLMAR IS YOURS</h1>
            <p class="tag">All four jobs done. The city knows your name now.</p>
            <p class="stats">Total take: <b>$${data.money}</b><br>Time in the city: <b>${data.time}</b></p>
            <button id="btn-freeroam">▶ &nbsp;KEEP EXPLORING</button>
            <button id="btn-restart2">↻ &nbsp;PLAY AGAIN</button>
          </div>`;
        document.getElementById('btn-freeroam').onclick = () => callbacks.onFreeRoam();
        document.getElementById('btn-restart2').onclick = () => callbacks.onRestart();
      } else if (name === 'gameover') {
        screenEl.innerHTML = `
          <div class="panel">
            <h1>WASTED</h1>
            <p class="tag">The cops dragged you out of Solmar City in cuffs.<br>Your take: $${data.money}.</p>
            <button id="btn-retry">↻ &nbsp;TRY AGAIN</button>
          </div>`;
        document.getElementById('btn-retry').onclick = () => callbacks.onRestart();
      } else {
        screenEl.innerHTML = '';
      }
    },
  };
  return H;
}
