// Seeded randomness for Solmar City: every procedural choice in the game
// (city layout, traffic, pedestrians, mission anchors) comes from one seed,
// so the same seed always builds the same city. No Math.random anywhere
// in the game code, which keeps the ?shot= screenshots deterministic.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small helper object around a seeded stream, so call sites read plainly.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Integer in [min, max] inclusive.
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // One element of a non-empty array.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // A coin flip that lands true with probability p.
    chance(p) {
      return next() < p;
    },
    // A shuffled copy of an array (Fisher-Yates).
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}

// A deterministic 2D hash for static decoration: same (x, z) always gives
// the same value, so lamps and palms never need stored state.
export function hash2(x, z, seed = 1337) {
  let h = (Math.floor(x) * 374761393 + Math.floor(z) * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
}
