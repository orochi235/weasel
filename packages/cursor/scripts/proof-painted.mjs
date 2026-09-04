// The painted tier's own proof. `proof-pixels.mjs` bakes, so it cannot show a
// glyph that only the painter can draw — a world-sized brush is never a CSS
// cursor at any radius, and `bakeCursor` throws past 128px anyway.
//
//   npm run proof:painted                    # brush at the default radii
//   node --import ./packages/cursor/scripts/ts-resolve.mjs \
//        packages/cursor/scripts/proof-painted.mjs brush 8,40,200
//
// Renders through `cursorPaintOps` + `cursorPaintMatrix` — the same two calls
// the canvas layer makes — so the geometry and the line weights under test are
// the shipped ones. What it cannot check is the GL renderer's own rasterizing;
// for that, look at the layer in a browser.
//
// Requires resvg and ImageMagick on PATH.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chromeLineWidthScale,
  cursorPaintMatrix,
  cursorPaintOps,
  cursorWorldSize,
} from '../src/paint.ts';
import { GLYPHS } from '../src/glyphs.ts';

const DPRS = [1, 2];
const GROUND = process.env.GROUND ?? '#ffffff';
const dir = mkdtempSync(join(tmpdir(), 'cursor-painted-'));

const el = (op) => {
  const fill = op.fill === undefined ? 'none' : op.fill;
  const stroke = op.stroke
    ? ` stroke="${op.stroke.color}" stroke-width="${op.stroke.width}"` +
      ` stroke-linecap="round" stroke-linejoin="round"`
    : '';
  return `<path d="${op.d}" fill="${fill}"${stroke}/>`;
};

/** One glyph painted at a world radius, on a `pad`-margined canvas. */
const raster = (name, worldRadius, dpr) => {
  const glyph = GLYPHS[name];
  const size = cursorWorldSize(glyph, worldRadius, 1);
  // Line weight stays chrome weight while the geometry scales — the rule the
  // layer applies for a world-sized spec.
  const ops = cursorPaintOps(glyph, { lineWidthScale: chromeLineWidthScale(glyph, size) });
  const pad = 8;
  const side = Math.ceil(size) + pad * 2;
  const at = { x: side / 2, y: side / 2 };
  const m = cursorPaintMatrix(glyph, { size, at });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"` +
    ` viewBox="0 0 ${side} ${side}">` +
    `<g transform="matrix(${m.join(' ')})">${ops.map(el).join('')}</g></svg>`;

  const src = join(dir, `${name}-${worldRadius}-${dpr}.svg`);
  const png = src.replace(/\.svg$/, '.png');
  writeFileSync(src, svg);
  execFileSync('resvg', ['--width', String(side * dpr), '--height', String(side * dpr), src, png]);
  execFileSync('magick', [png, '-background', GROUND, '-flatten', png]);
  return png;
};

const names = (process.argv[2] ?? 'brush').split(',');
const radii = (process.argv[3] ?? '6,20,60,180').split(',').map(Number);
const rows = names.flatMap((name) =>
  DPRS.map((dpr) => radii.map((r) => raster(name, r, dpr))),
);
const out = process.env.OUT ?? 'cursor-painted.png';
execFileSync('magick', [
  ...rows.flatMap((r) => ['(', ...r, '-background', GROUND, '-gravity', 'center', '+append', ')']),
  '-background', '#f4f4f2', '-gravity', 'west', '-append', out,
]);
console.log('wrote', out, '—', names.join(', '), '@ r =', radii.join(', '), '· 1x and 2x');
