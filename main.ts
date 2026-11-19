// Vice Harbor: a top-down open-world crime game, built as plain static files for a desktop browser
// (Node 22, standard library only). game/ holds the whole game: index.html and its ES modules, no
// library, no build step and no network request. Everything is drawn procedurally on a 2D canvas
// and every sound is synthesised with WebAudio, so the entry ships no assets at all.
//
// This program is the hand-in, not the game: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. The city itself — five districts, six vehicle classes, traffic, crowds, a
// five-star wanted level, six story missions, two side jobs and a localStorage save — lives in
// game/src/ behind index.html.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080. Add ?shot=chase|foot|
// drive|mission&seed=7 to any URL to stage one of the screenshot scenes.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Every file and directory under a folder, counted the way the gate counts game/. */
function measureTree(root: string): { files: number; directories: number; bytes: number } {
  let files = 0;
  let directories = 0;
  let bytes = 0;
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        directories += 1;
        walk(child);
      } else if (entry.isFile()) {
        files += 1;
        bytes += statSync(child).size;
      }
    }
  };
  walk(root);
  return { files, directories, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// What was handed in, printed so a run can be read at a glance.
const shipped = measureTree(join(out, 'game'));
console.log(`Vice Harbor: ${shipped.files} files in ${shipped.directories} directories, ${(shipped.bytes / 1024).toFixed(1)} KiB of game/`);
console.log(`dossier.json: ${dossier.length} bytes (${(dossier.length / 1024).toFixed(1)} KiB) at ${join(out, 'dossier.json')}`);
