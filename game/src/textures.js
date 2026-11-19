// Procedural canvas textures: the game ships no image files at all.
// Every facade, road and billboard is painted at runtime on a canvas and
// used as a THREE.CanvasTexture, so the whole game stays offline and
// self-contained.

import * as THREE from 'three';

// One building facade: a base colour with lit and dark windows in a grid.
// `floors` and `cols` set the window density; the texture repeats once
// per face, so a tall tower gets more windows by repeating it.
export function facadeTexture(baseColor, floors, cols, rng) {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, w, h);
  // Subtle vertical shading so the face is not flat.
  const shade = g.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.18)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  // Windows: a grid with some lit, some dark, some shuttered.
  const cellW = w / cols;
  const cellH = h / floors;
  for (let row = 0; row < floors; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW + cellW * 0.22;
      const y = row * cellH + cellH * 0.22;
      const ww = cellW * 0.56;
      const hh = cellH * 0.56;
      const roll = rng.next();
      if (roll < 0.22) {
        g.fillStyle = '#ffd98a'; // lit window, warm
      } else if (roll < 0.3) {
        g.fillStyle = '#7a6a58'; // shuttered
      } else {
        g.fillStyle = '#24384e'; // dark glass
      }
      g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x, y, ww, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// One stretch of road: dark asphalt with a dashed centre line and edge
// lines. The texture repeats along the road's length.
export function roadTexture() {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#33363c';
  g.fillRect(0, 0, w, h);
  // Asphalt speckle.
  for (let i = 0; i < 900; i++) {
    const v = 40 + Math.floor(Math.random() * 30);
    g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  // Edge lines.
  g.fillStyle = '#d8d8d8';
  g.fillRect(6, 0, 3, h);
  g.fillRect(w - 9, 0, 3, h);
  // Dashed centre line.
  g.fillStyle = '#f0d040';
  for (let y = 0; y < h; y += 64) {
    g.fillRect(w / 2 - 2, y, 4, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// A big painted billboard: bold text on a bright field, with a sub-line.
export function billboardTexture(title, sub, bg, fg) {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, w / 2, h / 2 - 28);
  g.font = 'bold 30px Arial, sans-serif';
  g.fillText(sub, w / 2, h / 2 + 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Ground beyond the city: patchy grass and sand, low detail on purpose so
// the eye stays on the streets.
export function groundTexture() {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#9aa578';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const roll = Math.random();
    g.fillStyle = roll < 0.5 ? 'rgba(120,140,90,0.5)' : 'rgba(190,180,140,0.4)';
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
