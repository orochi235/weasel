// The pixel-grid check, which the 11x sheet cannot stand in for: rasterize
// each glyph at the device pixels a 16px chrome cursor actually gets, then
// magnify nearest-neighbour so what you look at is the renderer's output.
//
//   npm run proof:pixels           # or:
//   node --import ./packages/cursor/scripts/ts-resolve.mjs \
//        packages/cursor/scripts/proof-pixels.mjs [outfile.png]
//
// 1x and 2x disagree and neither is the answer on its own: at 1x a 16px glyph
// gets 16 device pixels and fine detail collapses; at 2x the same drawing
// resolves. Both rows ship here for that reason.
//
// Requires resvg and ImageMagick on PATH.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bakeCursor } from '../src/bake.ts';
import { GLYPHS } from '../src/glyphs.ts';

const SIZES = [[16, 1], [16, 2], [24, 1], [24, 2]];
const MAG = 10;
const GROUND = process.argv[3] ?? '#ffffff';
const dir = mkdtempSync(join(tmpdir(), 'cursor-px-'));

/** The shipped asset, rasterized at `css * dpr` device pixels. */
const raster = (name, css, dpr, angle) => {
  const s = bakeCursor(GLYPHS[name], { size: css, angle });
  const svg = decodeURIComponent(s.slice(s.indexOf('data:') + 19, s.indexOf('") ')));
  const src = join(dir, `${name}-${css}-${dpr}-${angle}.svg`);
  const png = src.replace(/\.svg$/, '.png');
  writeFileSync(src, svg);
  execFileSync('resvg', ['--width', String(css * dpr), '--height', String(css * dpr), src, png]);
  // Nearest-neighbour, or the magnification resamples away the thing under test.
  execFileSync('magick', [
    png, '-background', GROUND, '-flatten',
    '-filter', 'point', '-resize', `${MAG * 100}%`, png,
  ]);
  return png;
};

const names = process.argv[2] ? process.argv[2].split(',') : Object.keys(GLYPHS);
// Every fourth step, so a rotated bake is checked on the grid it ships on
// rather than only in the vector sheet.
const ANGLES = process.env.ANGLES
  ? process.env.ANGLES.split(',').map(Number)
  : [0];
const rows = names.flatMap((name) =>
  ANGLES.map((a) => SIZES.map(([css, dpr]) => raster(name, css, dpr, a))),
);
const out = process.env.OUT ?? 'cursor-pixels.png';
execFileSync('magick', [
  ...rows.flatMap((r) => ['(', ...r, '+append', ')']),
  '-background', '#f4f4f2', '-gravity', 'west', '-append', out,
]);
console.log('wrote', out, '—', names.join(', '), '@', SIZES.map(([c, d]) => `${c}x${d}`).join(' '));
