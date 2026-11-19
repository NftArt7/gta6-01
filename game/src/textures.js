// Solmar City — procedural canvas textures. Every facade, road and ground
// texture in the city is painted here at load time; no image assets ship.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick } from './util.js';

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A building facade: coloured plaster, a grid of lit and dark windows,
// a darker ground-floor band with a door and a shop awning on some floors.
export function facadeTexture(seed) {
  const rng = mulberry32(seed);
  const palettes = [
    ['#e8b48a', '#c98d5f', '#f2d3ac'],
    ['#8fb6c9', '#6d93a8', '#bcd6e2'],
    ['#d9a0a0', '#b57a7a', '#eec6c6'],
    ['#a8c69f', '#7fa377', '#cfe0c8'],
    ['#c9b18a', '#a68d63', '#e0cda6'],
    ['#9d9bb8', '#76748f', '#c2c0d6'],
  ];
  const [base, dark, light] = pick(rng, palettes);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // faint vertical grime streaks
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
      const x = rng() * w;
      g.fillRect(x, 0, 2 + rng() * 6, h);
    }
    // window grid
    const cols = 5;
    const rows = 7;
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < 0.28;
        g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#2c3a4a' : '#3d556e');
        g.fillRect(c * cw + 8, r * rh + 10, cw - 16, rh - 20);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(c * cw + 8, r * rh + 10, cw - 16, 4);
      }
    }
    // ground floor: darker band, door, awning
    g.fillStyle = dark;
    g.fillRect(0, h - 40, w, 40);
    g.fillStyle = '#22252c';
    g.fillRect(w / 2 - 14, h - 38, 28, 38);
    if (rng() < 0.6) {
      g.fillStyle = pick(rng, ['#d9534f', '#4f9fd8', '#e8a13c', '#58b368']);
      g.fillRect(6, h - 52, w - 12, 12);
    }
    g.fillStyle = light;
    g.fillRect(0, 0, w, 6);
  });
}

export function roofTexture(seed) {
  const rng = mulberry32(seed);
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = pick(rng, ['#5a5f66', '#6b5d4f', '#4f5a52', '#7a6a5e']);
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 8; i++) g.fillRect(rng() * w, rng() * h, 14 + rng() * 20, 10 + rng() * 14);
    g.strokeStyle = 'rgba(255,255,255,0.15)';
    g.strokeRect(4, 4, w - 8, h - 8);
  });
}

// Asphalt with a dashed centre line and worn edges.
export function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#33363b';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(255,255,255,${rng01() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = '#e8d44d';
    g.fillRect(w / 2 - 2, 0, 4, 40);
    g.fillRect(w / 2 - 2, 64, 4, 40);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(2, 0, 3, h);
    g.fillRect(w - 5, 0, 3, h);
  });
  function rng01() { return Math.random(); }
}

export function pavementTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#8d8578';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
    }
  });
}

export function grassTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#5d8a4a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${20 + Math.random() * 60 | 0},${120 + Math.random() * 60 | 0},40,0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
  });
}

export function sandTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#e0c98f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(120,90,40,${Math.random() * 0.25})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// A glowing neon shop sign, drawn as text on a dark board.
export function signTexture(text, color = '#ff5da2') {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#14121c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 1);
  });
}
