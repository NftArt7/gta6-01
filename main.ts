// Hands Solmar City in: copies game/ and screenshots/ into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendored library. Runs on Node 22 with no install and no network:
// `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` (outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output).

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || 'out');

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(here, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ beside main.ts`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = countFiles(join(outDir, 'game'));
const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
console.log(`Solmar City handed in: ${gameFiles} game entries, ${shots.length} screenshots, dossier ${dossier.length} bytes`);
