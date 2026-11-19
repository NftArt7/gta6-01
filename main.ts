// Solmar City — the entry program for make.fun gta6-01 (Node 22, stdlib only).
// It hands the game in: every file under game/ and screenshots/ is copied
// into the output directory, and /output/dossier.json is written by the
// vendored make.fun library so the judge can read the game from its source
// outline and screenshots. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function copyDir(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return countEntries(to);
}

function countEntries(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    n += 1;
    if (statSync(full).isDirectory()) n += countEntries(full);
  }
  return n;
}

mkdirSync(outputDir, { recursive: true });
const gameEntries = copyDir('game');
const shotEntries = copyDir('screenshots');

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(
  `Solmar City handed in: ${gameEntries} game entries, ${shotEntries} screenshots, dossier ${dossier.length} bytes -> ${outputDir}`,
);
