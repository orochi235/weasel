import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { CRAYONS, crayonHex } from './generate';
import { toLch } from './oklch';

describe('crayons', () => {
  it('every name resolves to a color at the hue and lightness it declares', () => {
    for (const [name, [hue, L]] of Object.entries(CRAYONS)) {
      const m = toLch(crayonHex(name));
      expect(m.L, `${name} lightness`).toBeCloseTo(L, 1);
      void hue;
      // Near-neutral colors have an unstable hue; only check where chroma is real.
      if (m.C > 0.03) {
        const d = Math.abs(((m.H - hue + 540) % 360) - 180);
        expect(d, `${name} hue`).toBeLessThan(4);
      }
    }
  });

  it('has no two names close enough to be one color', () => {
    const names = Object.keys(CRAYONS);
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const a = toLch(crayonHex(names[i]));
        const b = toLch(crayonHex(names[j]));
        const hueApart = Math.abs(((a.H - b.H + 540) % 360) - 180);
        const lightApart = Math.abs(a.L - b.L);
        const chromaApart = Math.abs(a.C - b.C);
        expect(
          hueApart > 6 || lightApart > 0.06 || chromaApart > 0.04,
          `${names[i]} and ${names[j]} are the same color`,
        ).toBe(true);
      }
    }
  });

  it('writes a proof sheet when asked', () => {
    const out = process.env.WZL_CRAYON_SHEET;
    if (!out) return;
    const cells = Object.entries(CRAYONS)
      .map(([n, [h, l, f]]) => {
        const hex = crayonHex(n);
        const m = toLch(hex);
        return `<div class="c"><div class="sw" style="background:${hex}"></div><b>${n}</b>
          <span>${hex}</span><span>h ${h} \u00b7 L ${l.toFixed(2)} \u00b7 C ${m.C.toFixed(3)}${
            f === undefined ? '' : ` \u00b7 ${Math.round(f * 100)}% cap`
          }</span></div>`;
      })
      .join('\n');
    writeFileSync(
      out,
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Named colors</title><style>
      body{margin:0;background:#14161a;color:#e6e7e9;font:13px/1.5 system-ui,sans-serif}
      .pad{padding:28px}h2{margin:0 0 4px;font-size:22px}p{color:#9ea1a8;margin:0 0 20px;max-width:70ch}
      .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px}
      .c{display:flex;flex-direction:column;gap:1px}.sw{height:54px;border-radius:6px;margin-bottom:4px}
      b{font-size:13px}span{color:#9ea1a8;font-size:10px;font-family:ui-monospace,Menlo,monospace}
      .l{background:#f5f5f6;color:#16181c}.l p{color:#5a5e66}.l span{color:#6a6e76}
      </style></head><body>
      <div class="pad"><h2>Named colors, on ink</h2>
      <p>Each declared as a hue and a lightness; the color is the most chroma sRGB allows there,
      unless the row names a fraction of it. A muted name has to say so \u2014 hue and lightness
      alone can only describe vivid colors, so a tan asked for at full chroma comes back an amber.
      No hex is typed by hand.</p>
      <div class="g">${cells}</div></div>
      <div class="l pad"><h2>On paper</h2><p>The same colors, on the surface most of them are hardest on.</p>
      <div class="g">${cells}</div></div>
      </body></html>`,
    );
  });
});
