import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GlMat3 } from '@weasel-js/geom';
import { glyphCorners, placeGlyph } from './glyphCorners';
import { affine, runs, spread, tally } from './pbt.fixture';

/** One glyph quad as a group's `quadData` holds it: its box, atlas rect, baseline, pen, and turn. */
const glyph = fc.record({
  x0: spread(-100, 100), y0: spread(-100, 100),
  w: fc.oneof(spread(0.5, 60), spread(-60, -0.5)), h: fc.oneof(spread(0.5, 60), spread(-60, -0.5)),
  u0: spread(0, 1), v0: spread(0, 1), du: spread(-0.5, 0.5).filter((d) => d !== 0), dv: spread(-0.5, 0.5).filter((d) => d !== 0),
  baseline: spread(-100, 100), pen: spread(-100, 100),
  rotate: fc.oneof(fc.constant(0), spread(-360, 360)),
}).map((g) => [g.x0, g.y0, g.x0 + g.w, g.y0 + g.h, g.u0, g.v0, g.u0 + g.du, g.v0 + g.dv, g.baseline, g.pen, g.rotate]);

const tan = fc.oneof(fc.constant(0), spread(-0.5, 0.5));

/** Distance between the line through `a`, `b` and the parallel one through `c`. */
function apart(c: readonly number[], a: number, b: number, d: number): number {
  const ex = c[2 * b]! - c[2 * a]!, ey = c[2 * b + 1]! - c[2 * a + 1]!;
  return Math.abs(ex * (c[2 * d + 1]! - c[2 * a + 1]!) - ey * (c[2 * d]! - c[2 * a]!)) / Math.hypot(ex, ey);
}

/** The screen point a texture coordinate lands on, by the affine map the quad's corners and atlas rect define. */
function atUv(c: readonly number[], uv: readonly number[], u: number, v: number): [number, number] {
  const s = (u - uv[0]!) / (uv[2]! - uv[0]!), t = (v - uv[1]!) / (uv[3]! - uv[1]!);
  return [c[0]! + s * (c[2]! - c[0]!) + t * (c[6]! - c[0]!), c[1]! + s * (c[3]! - c[1]!) + t * (c[7]! - c[1]!)];
}

const place = (q: number[], ox: number, oy: number, k: number, m: GlMat3, grow: number) => {
  const out = { xy: new Array<number>(8).fill(0), uv: new Array<number>(4).fill(0) };
  placeGlyph(q, 0, ox, oy, k, m, grow, out);
  return out;
};

describe('glyphCorners, property', () => {
  it('places a parallelogram, the box itself when upright, each corner as far from the pen as unturned', () => {
    fc.assert(fc.property(glyph, spread(-50, 50), spread(-50, 50), tan, (q, ox, oy, k) => {
      const c = new Array<number>(8).fill(0);
      glyphCorners(q, 0, ox, oy, k, c);
      const tol = 1e-9 * 1000;
      expect(Math.abs(c[0]! + c[4]! - c[2]! - c[6]!)).toBeLessThan(tol);
      expect(Math.abs(c[1]! + c[5]! - c[3]! - c[7]!)).toBeLessThan(tol);
      const flat = new Array<number>(8).fill(0);
      glyphCorners([...q.slice(0, 10), 0], 0, ox, oy, k, flat);
      const px = q[9]! + ox, py = q[8]! + oy;
      for (let i = 0; i < 8; i += 2) {
        expect(Math.abs(Math.hypot(c[i]! - px, c[i + 1]! - py) - Math.hypot(flat[i]! - px, flat[i + 1]! - py))).toBeLessThan(tol);
      }
      if (k === 0 && q[10] === 0) {
        expect(c).toEqual([q[0]! + ox, q[1]! + oy, q[2]! + ox, q[1]! + oy, q[2]! + ox, q[3]! + oy, q[0]! + ox, q[3]! + oy]);
      }
    }), runs(300));
  });
});

describe('placeGlyph, property', () => {
  it('grows the quad by `grow` screen units across each pair of opposite edges, its texels staying put', () => {
    const t = tally();
    fc.assert(fc.property(glyph, spread(-50, 50), spread(-50, 50), tan, affine, spread(0, 4), (q, ox, oy, k, m, grow) => {
      const bare = place(q, ox, oy, k, m, 0), grown = place(q, ox, oy, k, m, grow);
      const size = Math.max(...bare.xy.map(Math.abs), 1);
      const tol = 1e-9 * size;
      t.count(grow > 0 ? 'grown' : 'bare');
      expect(Math.abs(apart(grown.xy, 0, 1, 3) - apart(bare.xy, 0, 1, 3) - 2 * grow), 'top to bottom').toBeLessThan(tol);
      expect(Math.abs(apart(grown.xy, 0, 3, 1) - apart(bare.xy, 0, 3, 1) - 2 * grow), 'left to right').toBeLessThan(tol);
      for (const [u, v] of [[bare.uv[0]!, bare.uv[1]!], [bare.uv[2]!, bare.uv[3]!], [(bare.uv[0]! + bare.uv[2]!) / 2, bare.uv[1]!]]) {
        const [ax, ay] = atUv(bare.xy, bare.uv, u!, v!), [bx, by] = atUv(grown.xy, grown.uv, u!, v!);
        expect(Math.hypot(ax - bx, ay - by), `uv ${u}, ${v}`).toBeLessThan(1e-7 * size);
      }
    }), runs(300));
    t.atLeast('grown', 100);
  });
});
