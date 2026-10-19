// Renders the extension's icons from the site's logo into public/icons/, centered on a square.
// Rerun after the logo changes: `npm run gen:devtools-extension-icons`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ICON_SIZES } from '../manifest.ts';

const app = resolve(import.meta.dirname, '..');
const logo = readFileSync(resolve(app, '../site/assets/weasel-logo.svg'), 'utf8');

/** `svg` with its viewBox widened or heightened to a square around the same center. */
function squared(svg: string): string {
  return svg.replace(/viewBox="([^"]+)"/, (_, box: string) => {
    const [x, y, w, h] = box.trim().split(/\s+/).map(Number) as [number, number, number, number];
    const side = Math.max(w, h);
    return `viewBox="${x - (side - w) / 2} ${y - (side - h) / 2} ${side} ${side}"`;
  });
}

const out = resolve(app, 'public/icons');
mkdirSync(out, { recursive: true });
const square = squared(logo);
for (const size of ICON_SIZES) {
  const png = new Resvg(square, { fitTo: { mode: 'width', value: size } }).render().asPng();
  const file = resolve(out, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`devtools-extension: ${file}`);
}
