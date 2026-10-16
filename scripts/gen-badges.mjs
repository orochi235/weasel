#!/usr/bin/env node
/**
 * Writes the glyphs the README's package table marks each package with, to
 * docs/badges/. They are colored rather than `currentColor`: an SVG shown
 * through <img> cannot inherit the page's text color, so each color has to
 * hold 3:1 against GitHub's light and dark backgrounds, and this checks it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/badges');

const BACKGROUNDS = { light: '#ffffff', dark: '#0d1117' };
const C = {
  react: '#0f8bb5',
  optional: '#848d97',
  dom: '#d9601a',
  audio: '#2a9d4a',
  standalone: '#9a6bf0',
  edge: '#848d97',
  r: '#e5534b',
  g: '#2a9d4a',
  b: '#3f86f0',
};

const n = (v) => Math.round(v * 1e4) / 1e4;
const polar = (cx, cy, r, deg) => [n(cx + r * Math.cos((deg * Math.PI) / 180)), n(cy + r * Math.sin((deg * Math.PI) / 180))];

const svg = (title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" role="img" aria-label="${title}">` +
  `<title>${title}</title>` +
  `<g fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;

const atom = (color) =>
  [0, 60, 120]
    .map((a) => `<ellipse cx="10" cy="10" rx="8.25" ry="3.1" stroke="${color}" transform="rotate(${a} 10 10)"/>`)
    .join('') + `<circle cx="10" cy="10" r="1.6" fill="${color}"/>`;

// A browser window, every edge on a whole pixel at 20px. The filled title bar
// is what keeps it a window that small.
const window_ =
  `<rect x="3" y="4" width="14" height="12" rx="1.5" stroke="${C.dom}" stroke-width="2"/>` +
  `<path d="M2 8V4.5A1.5 1.5 0 0 1 3.5 3h13A1.5 1.5 0 0 1 18 4.5V8z" fill="${C.dom}" stroke="none"/>`;

// The hello triangle: one red, one green and one blue vertex.
const V = [[10, 3], [17, 16], [3, 16]];
const triangle =
  `<path d="M${V.map((p) => p.join(' ')).join('L')}z" stroke="${C.edge}"/>` +
  V.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.1" fill="${[C.r, C.g, C.b][i]}"/>`).join('');

// A speaker cone and two sound waves, each wave an arc about the cone's mouth.
const MOUTH = [10.5, 10];
const wave = (r) => {
  const [x1, y1] = polar(...MOUTH, r, -45);
  const [x2, y2] = polar(...MOUTH, r, 45);
  return `<path d="M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}" stroke="${C.audio}"/>`;
};
const speaker =
  `<path d="M2.75 7.5h2.75l4-3.25v11.5l-4-3.25H2.75z" fill="${C.audio}" stroke="${C.audio}"/>` + wave(3.25) + wave(6.25);

// A cube: one package, nothing outside it.
const hex = [-90, -30, 30, 90, 150, 210].map((a) => polar(10, 10, 7.5, a));
const cube =
  `<path d="M${hex[0].join(' ')}L${hex[1].join(' ')}L10 10L${hex[5].join(' ')}z" fill="${C.standalone}" stroke="${C.standalone}"/>` +
  `<path d="M${hex.map((p) => p.join(' ')).join('L')}z" stroke="${C.standalone}"/>` +
  `<path d="M10 10V${hex[3][1]}" stroke="${C.standalone}"/>`;

export const BADGES = {
  react: { title: 'Needs React', body: atom(C.react) },
  'react-optional': { title: 'React only under the /react subpath', body: atom(C.optional) },
  dom: { title: 'Needs a browser: document, window or navigator', body: window_ },
  webgl2: { title: 'Draws with WebGL2', body: triangle },
  webaudio: { title: 'Plays through Web Audio', body: speaker },
  standalone: { title: 'Depends on no other weasel package', body: cube },
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failed = false;
for (const [name, color] of Object.entries(C)) {
  for (const [mode, bg] of Object.entries(BACKGROUNDS)) {
    const ratio = contrast(color, bg);
    if (ratio < 3) {
      console.error(`${name} ${color} is ${ratio.toFixed(2)}:1 on ${mode} ${bg}; non-text marks need 3:1`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);

mkdirSync(out, { recursive: true });
for (const [name, { title, body }] of Object.entries(BADGES)) {
  writeFileSync(resolve(out, `${name}.svg`), svg(title, body));
}
console.log(`wrote ${Object.keys(BADGES).length} badges to docs/badges/`);
