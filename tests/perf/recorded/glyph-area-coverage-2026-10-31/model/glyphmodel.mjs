// CPU model of glyphCoverage on Inter's baked atlas, one glyph quad: the shader's field read,
// smoothstep and taps, and (opts.msaa) the 4x sample pattern clipping pixels at the quad's edge.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const repo = new URL('../../../../../', import.meta.url);
const require = createRequire(new URL('package.json', repo));
const { PNG } = require('pngjs');
const root = new URL('assets/fonts/inter/', repo).pathname;
const png = PNG.sync.read(fs.readFileSync(root + 'inter.png'));
export const W = png.width, H = png.height;
export const font = JSON.parse(fs.readFileSync(root + 'inter.json'));
export const glyphH = font.chars.find((c) => c.char === 'H');
const range = font.distanceField.distanceRange;
function chan(xx, yy, k) {
  xx = Math.min(W - 1, Math.max(0, xx)); yy = Math.min(H - 1, Math.max(0, yy));
  return png.data[(yy * W + xx) * 4 + k] / 255;
}
export function field(u, v, opts = {}) {
  if (opts.cell) { const c = opts.cell; if (u < c[0] || u > c[2] || v < c[1] || v > c[3]) return 0; }
  const x = u * W - 0.5, y = v * H - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  let fx = x - x0, fy = y - y0;
  if (opts.fracBits) { const q = 1 << opts.fracBits; fx = Math.round(fx * q) / q; fy = Math.round(fy * q) / q; }
  const ch = (k) => (chan(x0, y0, k) * (1 - fx) + chan(x0 + 1, y0, k) * fx) * (1 - fy)
    + (chan(x0, y0 + 1, k) * (1 - fx) + chan(x0 + 1, y0 + 1, k) * fx) * fy;
  const r = ch(0), g = ch(1), b = ch(2);
  return Math.max(Math.min(r, g), Math.min(Math.max(r, g), b));
}
/** opts: taps ('rot4' | 'point' | 'exact'), fracBits, w, h */
export function render(size, qx0, qy0, opts = {}) {
  const g = opts.glyph ?? glyphH;
  const s = size / font.info.size;
  const w = opts.w ?? 32, h = opts.h ?? 24;
  const qx1 = qx0 + g.width * s, qy1 = qy0 + g.height * s;
  const cu0 = g.x / W, cv0 = g.y / H;
  const du = 1 / (W * s), dv = 1 / (H * s);
  const fieldPerPx = 0.5 * (du * W / range + dv * H / range);
  const aaW = Math.max(0.5 * fieldPerPx, 0.0005);
  const area = Math.min(1, Math.max(0, (fieldPerPx - 0.2) / 0.1)); const ar = area * area * (3 - 2 * area);
  const img = new Float64Array(w * h);
  const ex = opts.expand ?? 0;
  if (opts.clip) opts = { ...opts, cell: [cu0, cv0, cu0 + g.width / W, cv0 + g.height / H] };
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const cx = px + 0.5, cy = py + 0.5;
    let msaa = 1;
    if (opts.msaa) {
      const S = [[-1 / 8, -3 / 8], [3 / 8, -1 / 8], [-3 / 8, 1 / 8], [1 / 8, 3 / 8]];
      msaa = S.filter(([a, b]) => cx + a >= qx0 - ex && cx + a < qx1 + ex && cy + b >= qy0 - ex && cy + b < qy1 + ex).length / 4;
      if (msaa === 0) continue;
    } else if (cx < qx0 - ex || cx >= qx1 + ex || cy < qy0 - ex || cy >= qy1 + ex) continue;
    const u = cu0 + (cx - qx0) * du, v = cv0 + (cy - qy0) * dv;
    const f = field(u, v, opts);
    const t = Math.min(1, Math.max(0, (f - (0.5 - aaW)) / (2 * aaW)));
    let cov = t * t * (3 - 2 * t);
    if (ar > 0 && opts.taps !== 'point') {
      let sum = 0;
      if (opts.taps === 'exact') {
        const n = opts.n ?? 16;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const fu = field(u + ((i + 0.5) / n - 0.5) * du, v + ((j + 0.5) / n - 0.5) * dv, opts);
          sum += fu > 0.5 ? 1 : 0;
        }
        sum = 4 * sum / (n * n);
      } else if (opts.taps === 'grid16' || opts.taps === 'tap0') {
        const band = 0.5 * aaW, lo = 0.5 - 0.5 * band;
        const pts = opts.taps === 'tap0' ? [[0, 0]] : [0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3].map((j) => [(i - 1.5) * 0.25, (j - 1.5) * 0.25]));
        const ts = opts.tapScale ?? 1; for (const [a, b] of pts) sum += Math.min(1, Math.max(0, (field(u + ts * a * du, v + ts * b * dv, opts) - lo) / band));
        sum = 4 * sum / pts.length;
      } else {
        const band = (opts.bandScale ?? 1) * 0.5 * aaW, lo = 0.5 - 0.5 * band;
        let at = [-0.375, -0.125];
        for (let i = 0; i < 4; i++) {
          const ts = opts.tapScale ?? 1; const ff = field(u + ts * at[0] * du, v + ts * at[1] * dv, opts);
          sum += Math.min(1, Math.max(0, (ff - lo) / band));
          at = [-at[1], at[0]];
        }
      }
      cov = cov + (0.25 * sum - cov) * ar;
    }
    cov *= msaa;
    img[py * w + px] = opts.quantize === false ? cov : Math.round(cov * 255) / 255;
  }
  return img;
}
export function stats(img, w, x) {
  let m = 0, s = 0;
  img.forEach((v, i) => { m += v; s += v * ((i % w) + 0.5); });
  return { mass: m, off: s / m - x };
}
