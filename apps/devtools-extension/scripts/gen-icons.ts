// Renders the extension's icons into public/icons/: the wordmark's "w", carrying the wordmark's whole
// gradient left to right, stretched to fill a transparent square edge to edge.
// Rerun after the wordmark changes: `npm run gen:devtools-extension-icons`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ICON_SIZES } from '../manifest.ts';

const app = resolve(import.meta.dirname, '..');

// Inter 700's "w" (Version 4.001, the face in apps/site/assets/fonts/inter-latin-700.woff2), in font units
// with y pointing down and the baseline at 0. opentype.js reads no woff2, so the outline is copied here.
const W_PATH =
  'M361 0 31 -1118H346L443 -705Q468 -594 497 -463.5Q526 -333 550 -175H516Q542 -329 573 -460Q604 -591 631 -705' +
  'L733 -1118H1009L1108 -705Q1134 -592 1165 -461.5Q1196 -331 1223 -175H1189Q1213 -330 1240.5 -460.5Q1268 -591 1294 -705' +
  'L1391 -1118H1710L1378 0H1073L949 -431Q931 -496 913 -574.5Q895 -653 878 -734.5Q861 -816 843 -887H896' +
  'Q879 -816 861.5 -734.5Q844 -653 826 -574Q808 -495 790 -431L666 0Z';
const W_BOX = { x: 31, y: -1118, w: 1679, h: 1118 };

/** The wordmark's gradient stops, read from its stylesheet so the two can't drift apart. */
function wordmarkStops(): { color: string; offset: string }[] {
  const css = readFileSync(resolve(app, '../site/FrontPage/Wordmark.module.css'), 'utf8');
  const start = /--mark-start:\s*(#[0-9a-f]{3,8})/i.exec(css)?.[1];
  const gradient = /linear-gradient\(90deg,(.*?)\);/s.exec(css)?.[1];
  if (!start || !gradient) throw new Error('gen-icons: Wordmark.module.css no longer has --mark-start and a 90deg gradient');
  const stops = [...gradient.matchAll(/(#[0-9a-f]{3,8}|var\(--mark-start\))\s+([\d.]+%)/gi)].map(([, color, offset]) => ({
    color: color!.startsWith('var(') ? start : color!,
    offset: offset!,
  }));
  if (stops.length < 2) throw new Error('gen-icons: could not read the wordmark gradient stops');
  return stops;
}

function iconSvg(): string {
  const stops = wordmarkStops()
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W_BOX.w}" height="${W_BOX.w}" ` +
    `viewBox="${W_BOX.x} ${W_BOX.y} ${W_BOX.w} ${W_BOX.h}" preserveAspectRatio="none">` +
    `<defs><linearGradient id="mark" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>` +
    `<path d="${W_PATH}" fill="url(#mark)"/></svg>`
  );
}

const out = resolve(app, 'public/icons');
mkdirSync(out, { recursive: true });
const svg = iconSvg();
for (const size of ICON_SIZES) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  const file = resolve(out, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`devtools-extension: ${file}`);
}
