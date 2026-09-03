// Headless proof sheet: every glyph over the three grounds a cursor actually
// crosses, large for geometry and again at true cursor size for legibility.
//
//   npm run proof:cursors            # or:
//   node --import ./packages/cursor/scripts/ts-resolve.mjs \
//        packages/cursor/scripts/proof-cursors.mjs [outfile.png]
//
// Requires resvg on PATH (`brew install resvg`).
//
// Everything drawn here comes from `bakeCursor`, so the sheet cannot disagree
// with the asset that ships. The true-size cells embed the baked data URI
// verbatim; the large cells inline its body so the geometry stays vector.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { bakeCursor } from '../src/bake.ts';
import { GLYPHS } from '../src/glyphs.ts';

const GROUNDS = [
  ['white page', '#ffffff'],
  ['dark chrome', '#2a2a2e'],
  ['mid-tone art', '#6f7d8c'],
];
const MAG = 11;

/** The data URI `bakeCursor` produced, for embedding as an <image>. */
const uriOf = (name, size) => {
  const css = bakeCursor(GLYPHS[name], { size });
  return css.slice(css.indexOf('data:'), css.indexOf('") '));
};

/** The same asset's inner markup, for scaling as vector. */
const bodyOf = (name) => {
  const svg = decodeURIComponent(uriOf(name, 24));
  return svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
};

const names = Object.keys(GLYPHS);
const CW = 24 * MAG + 150;
const CH = 24 * MAG + 40;
const W = 170 + GROUNDS.length * CW;
const H = 70 + names.length * CH;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#f4f4f2"/>
<style>.h{font:600 17px -apple-system,Helvetica,sans-serif;fill:#1b1b1f}
.g{font:500 13px -apple-system,Helvetica,sans-serif;fill:#555}</style>
<text x="16" y="30" class="h">Cursor glyph proof — ${MAG}x, plus the baked asset at 24 and 16 px</text>`;

for (const [gi, [label]] of GROUNDS.entries()) {
  svg += `<text x="${170 + gi * CW}" y="56" class="g">${label}</text>`;
}

names.forEach((name, ni) => {
  const y0 = 62 + ni * CH;
  svg += `<text x="16" y="${y0 + 28}" class="g">${name}</text>`;
  GROUNDS.forEach(([, bg], gi) => {
    const x0 = 170 + gi * CW;
    svg += `<rect x="${x0}" y="${y0}" width="${CW - 16}" height="${CH - 16}" fill="${bg}"/>`;
    svg += `<g transform="translate(${x0 + 8},${y0 + 8}) scale(${MAG})">${bodyOf(name)}</g>`;
    const tx = x0 + 24 * MAG + 20;
    svg += `<image x="${tx}" y="${y0 + 10}" width="24" height="24" xlink:href="${uriOf(name, 24)}"/>`;
    svg += `<image x="${tx}" y="${y0 + 44}" width="16" height="16" xlink:href="${uriOf(name, 16)}"/>`;
  });
});
svg += '</svg>';

const out = process.argv[2] ?? 'cursor-proof.png';
writeFileSync('/tmp/cursor-proof.svg', svg);
execFileSync('resvg', ['--zoom', '2', '/tmp/cursor-proof.svg', out]);
console.log('wrote', out);
