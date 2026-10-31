import fs from 'node:fs';
import { render, glyphH, font } from './glyphmodel.mjs';
const rows = fs.readFileSync(process.env.F, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.size === 7.2);
const s = 7.2 / font.info.size;
for (const o of JSON.parse(process.argv[2])) {
  let e = 0;
  for (const r of rows) { const m = render(7.2, r.x + glyphH.xoffset * s + 0.016, 5.3125, o); m.forEach((v, i) => { e += (v - r.red[i] / 255) ** 2; }); }
  console.log(JSON.stringify(o), e.toFixed(3));
}
