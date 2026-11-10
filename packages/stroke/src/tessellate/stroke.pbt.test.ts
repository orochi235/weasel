import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PathBuilder } from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';
import { splitForDash } from './dash';
import { eighth, pathOf, point, polyline, polylineDistance, runs, tally, timeoutFor, type Pt } from '../pbt.fixture';

const RUNS = runs(200);
const PAINT = { color: '#000' };

const cap = fc.constantFrom('butt', 'round', 'square') as fc.Arbitrary<'butt' | 'round' | 'square'>;
const join = fc.constantFrom('miter', 'round', 'bevel') as fc.Arbitrary<'miter' | 'round' | 'bevel'>;
const width = fc.integer({ min: 1, max: 160 }).map((n) => n / 8);
const miterLimit = fc.double({ min: 1, max: 10, noNaN: true });
const closed = fc.boolean();
const shape = closed.chain((c) => polyline({ closed: c, maxLength: 7 }).map((pts) => ({ pts, closed: c })));

const style = fc.record({ width, cap, join, miterLimit }).map((s): Stroke => ({ paint: PAINT, ...s }));

function points(v: ArrayLike<number>): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < v.length; i += 2) out.push({ x: v[i]!, y: v[i + 1]! });
  return out;
}

/** The summed area of a mesh's triangles, overlaps counted each time. */
function inkArea(m: { vertices: ArrayLike<number>; indices: ArrayLike<number> }): number {
  const v = m.vertices, ix = m.indices;
  let sum = 0;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i]! * 2, b = ix[i + 1]! * 2, c = ix[i + 2]! * 2;
    sum += Math.abs((v[b]! - v[a]!) * (v[c + 1]! - v[a + 1]!) - (v[c]! - v[a]!) * (v[b + 1]! - v[a + 1]!)) / 2;
  }
  return sum;
}

describe('tessellateStroke, property', () => {
  it('builds whole, finite triangles from any finite path, curves, dashes and trims included', () => {
    const seg = fc.tuple(fc.constantFrom('L', 'Q', 'C'), fc.array(point(), { minLength: 3, maxLength: 3 }));
    const dash = fc.option(fc.array(fc.integer({ min: 0, max: 40 }).map((n) => n / 4), { minLength: 1, maxLength: 4 }), { nil: undefined });
    const trim = fc.option(fc.record({ start: fc.double({ min: -0.2, max: 1.2, noNaN: true }), end: fc.double({ min: -0.2, max: 1.2, noNaN: true }) }), { nil: undefined });
    fc.assert(fc.property(point(), fc.array(seg, { minLength: 1, maxLength: 5 }), closed, style, dash, trim, (p0, segs, close, s, d, t) => {
      const b = new PathBuilder().moveTo(p0.x, p0.y);
      for (const [kind, [a, c, e]] of segs) {
        if (kind === 'L') b.lineTo(a!.x, a!.y);
        else if (kind === 'Q') b.quadTo(a!.x, a!.y, c!.x, c!.y);
        else b.curveTo(a!.x, a!.y, c!.x, c!.y, e!.x, e!.y);
      }
      if (close) b.close();
      const mesh = tessellateStroke(b.build(), { ...s, dash: d, trim: t });
      const count = mesh.vertices.length / 2;
      expect(mesh.indices.length % 3).toBe(0);
      for (const v of mesh.vertices) expect(Number.isFinite(v)).toBe(true);
      for (const i of mesh.indices) expect(i).toBeLessThan(count);
      expect(mesh.anchorA?.length).toBe(count);
    }), RUNS);
  }, timeoutFor(200, 20));

  it('keeps every vertex within the reach its miter limit and cap allow', () => {
    const checked = tally();
    fc.assert(fc.property(shape, style, ({ pts, closed: c }, s) => {
      const mesh = tessellateStroke(pathOf(pts, c), s);
      const half = (s.width as number) / 2;
      const reach = half * Math.max(s.join === 'miter' ? s.miterLimit! : 1, s.cap === 'square' ? Math.SQRT2 : 1) * (1 + 1e-4) + 1e-3;
      for (const v of points(mesh.vertices)) {
        const d = polylineDistance(v, pts, c);
        expect(d, `vertex ${v.x},${v.y}`).toBeLessThanOrEqual(reach);
      }
      if (mesh.indices.length > 0) checked.hit();
    }), RUNS);
    checked.atLeast(0.9, RUNS.numRuns);
  }, timeoutFor(200, 10));

  it('moves its mesh with the path it is given, translated or turned a quarter', () => {
    fc.assert(fc.property(shape, style, eighth(), eighth(), fc.boolean(), ({ pts, closed: c }, s, tx, ty, turn) => {
      const move = (p: Pt): Pt => (turn ? { x: -p.y, y: p.x } : { x: p.x + tx, y: p.y + ty });
      const a = tessellateStroke(pathOf(pts, c), s);
      const b = tessellateStroke(pathOf(pts.map(move), c), s);
      // An arc's step count reads its sweep off rounded vertices, so a half turn can take one step more.
      if (s.join === 'round' || s.cap === 'round') {
        // Float32 vertices move each edge by about an ulp of its coordinates.
        const reach = Math.max(...pts.map((p) => Math.abs(p.x) + Math.abs(p.y))) + Math.abs(tx) + Math.abs(ty) + (s.width as number);
        const edges = lengthOf(pts.flatMap((p) => [p.x, p.y])) + pts.length * (s.width as number);
        const tol = 0.02 * (s.width as number) ** 2 * pts.length + 8 * edges * reach * 2 ** -23;
        expect(Math.abs(inkArea(b) - inkArea(a))).toBeLessThanOrEqual(tol);
        return;
      }
      expect(Array.from(b.indices)).toEqual(Array.from(a.indices));
      const pa = points(a.vertices), pb = points(b.vertices);
      for (let i = 0; i < pa.length; i++) {
        const m = move(pa[i]!);
        const tol = 1e-4 * (1 + Math.abs(m.x) + Math.abs(m.y));
        expect(Math.abs(pb[i]!.x - m.x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(pb[i]!.y - m.y)).toBeLessThanOrEqual(tol);
      }
    }), RUNS);
  }, timeoutFor(200, 10));
});

/** How much of `[0, length]` a dash pattern starting `phase` in turns on. */
function onLength(pattern: number[], length: number, phase: number): number {
  const dash = pattern.length % 2 ? [...pattern, ...pattern] : pattern;
  const period = dash.reduce((x, y) => x + y, 0);
  let s = -(phase % period), on = 0, i = 0;
  while (s < length) {
    const e = s + dash[i]!;
    if (i % 2 === 0) on += Math.max(0, Math.min(e, length) - Math.max(s, 0));
    s = e;
    i = (i + 1) % dash.length;
  }
  return on;
}

const lengthOf = (pts: readonly number[]): number => {
  let l = 0;
  for (let i = 2; i < pts.length; i += 2) l += Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
  return l;
};

describe('splitForDash, property', () => {
  it('turns on as much of the line as its pattern says, each dash lying on the line', () => {
    const pattern = fc.array(fc.integer({ min: 0, max: 80 }).map((n) => n / 4), { minLength: 1, maxLength: 5 })
      .filter((p) => p.some((v) => v > 0));
    const checked = tally();
    fc.assert(fc.property(shape, pattern, fc.integer({ min: 0, max: 400 }).map((n) => n / 4), ({ pts, closed: c }, dash, phase) => {
      const [pl] = extractPolylines(pathOf(pts, c));
      const total = lengthOf([...pl!.points, ...(c ? pl!.points.slice(0, 2) : [])]);
      const pieces = splitForDash(pl!, dash, phase);
      if (pieces.length === 1 && pieces[0] === pl) return;
      checked.hit();
      let on = 0;
      for (const piece of pieces) {
        on += lengthOf(piece.points);
        for (const v of points(piece.points)) expect(polylineDistance(v, pts, c)).toBeLessThan(1e-6 * (1 + total));
      }
      expect(Math.abs(on - onLength(dash, total, phase))).toBeLessThanOrEqual(1e-6 * (1 + total));
    }), RUNS);
    checked.atLeast(0.5, RUNS.numRuns);
  }, timeoutFor(200, 5));
});
