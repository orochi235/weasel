import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PathBuilder, pathLengthTable, pointAtLength, type Path } from '@weasel-js/geom';
import { trimmedPath } from './trimmedPath';
import { insetPath } from './insetPath';
import { point, runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = runs(200);
const total = (p: Path): number => pathLengthTable(p).total;

/** Up to three subpaths of lines and cubics, each open or closed. */
const shape: fc.Arbitrary<Path> = fc.array(
  fc.record({
    from: point(100),
    segs: fc.array(fc.record({ curve: fc.boolean(), pts: fc.array(point(100), { minLength: 3, maxLength: 3 }) }), { minLength: 1, maxLength: 4 }),
    closed: fc.boolean(),
  }),
  { minLength: 1, maxLength: 3 },
).map((subs) => {
  const b = new PathBuilder();
  for (const { from, segs, closed } of subs) {
    b.moveTo(from.x, from.y);
    for (const { curve, pts: [p, q, r] } of segs) {
      if (curve) b.curveTo(p!.x, p!.y, q!.x, q!.y, r!.x, r!.y);
      else b.lineTo(r!.x, r!.y);
    }
    if (closed) b.close();
  }
  return b.build();
}).filter((p) => total(p) > 1);

/** Two fractions `lo < hi` of a whole, at least `gap` apart. */
const window = (gap = 0.01) => fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }))
  .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const).filter(([a, b]) => b - a >= gap);

const firstPoint = (p: Path): [number, number] => {
  if (p.kind === 'rect') return [p.x, p.y];
  return [p.coords[0]!, p.coords[1]!];
};

describe('trimmedPath, property', () => {
  it('keeps the share of the length its window names, starting where that share starts', () => {
    fc.assert(fc.property(shape, window(), (path, [a, b]) => {
      const T = total(path);
      const cut = trimmedPath(path, { start: a, end: b });
      expect(cut).not.toBeNull();
      expect(Math.abs(total(cut!.path) - (b - a) * T)).toBeLessThanOrEqual(1e-4 * T);
      const [x, y] = firstPoint(cut!.path);
      const { point: [px, py] } = pointAtLength(pathLengthTable(path), a * T);
      // The start is where the pen is at that length, or where a later subpath begins when it lands on a seam.
      const next = pointAtLength(pathLengthTable(path), a * T + 1e-3 * T).point;
      const near = (u: number, v: number) => Math.hypot(x - u, y - v) <= 1e-3 * (1 + T);
      expect(near(px, py) || near(next[0], next[1])).toBe(true);
    }), RUNS);
  }, timeoutFor(200, 10));

  it('draws the whole path, closed subpaths closed, under the window [0, 1]', () => {
    fc.assert(fc.property(shape, (path) => {
      const cut = trimmedPath(path, { start: 0, end: 1 })!;
      expect(Math.abs(total(cut.path) - total(path))).toBeLessThanOrEqual(1e-6 * total(path));
      const t = pathLengthTable(path);
      const drawn = t.runs.flatMap((r, i) => (t.runStart[i + 1]! - t.runStart[i]! > 1e-9 ? [r.closed] : []));
      expect(cut.fromClosed).toEqual(drawn);
      const closedOut = pathLengthTable(cut.path).runs.map((r) => r.closed);
      expect(closedOut).toEqual(cut.fromClosed);
    }), RUNS);
  }, timeoutFor(200, 10));

  it('composes: a window of a window is the window of the path it maps to', () => {
    const checked = tally();
    fc.assert(fc.property(shape, window(0.05), window(0.05), (path, [a, b], [c, d]) => {
      const T = total(path);
      const outer = trimmedPath(path, { start: a, end: b })!;
      const twice = trimmedPath(outer.path, { start: c, end: d });
      const once = trimmedPath(path, { start: a + c * (b - a), end: a + d * (b - a) });
      expect(twice === null).toBe(once === null);
      if (!twice || !once) return;
      checked.hit();
      expect(Math.abs(total(twice.path) - total(once.path))).toBeLessThanOrEqual(1e-4 * T);
      const [x1, y1] = firstPoint(twice.path), [x2, y2] = firstPoint(once.path);
      expect(Math.hypot(x1 - x2, y1 - y2)).toBeLessThanOrEqual(1e-3 * (1 + T));
    }), RUNS);
    checked.atLeast(0.9, RUNS.numRuns);
  }, timeoutFor(200, 20));
});

describe('insetPath, property', () => {
  it('cuts an open line back by its two insets, or answers null once they meet', () => {
    const open = fc.record({ from: point(100), to: fc.array(point(100), { minLength: 1, maxLength: 4 }), curve: fc.boolean() }).map(({ from, to, curve }) => {
      const b = new PathBuilder().moveTo(from.x, from.y);
      for (let i = 0; i < to.length; i++) {
        const p = to[i]!;
        if (curve && i > 0) b.curveTo(to[i - 1]!.y, p.x, p.y, to[i - 1]!.x, p.x, p.y);
        else b.lineTo(p.x, p.y);
      }
      return b.build();
    }).filter((p) => total(p) > 1);
    const share = fc.double({ min: 0, max: 1, noNaN: true });
    // Half the cases ask for insets that together reach past the line.
    const insets = fc.tuple(share, share, fc.boolean()).map(([s, e, past]) => (past ? [s, 1 - s + e * 0.5] : [s * 0.7, e * 0.3]));
    const met = tally();
    fc.assert(fc.property(open, insets, (path, [s, e]) => {
      const T = total(path);
      const cut = insetPath(path, s * T, e * T);
      if (s + e >= 1) {
        expect(cut).toBeNull();
        met.hit();
        return;
      }
      if (1 - s - e < 1e-6) return;
      expect(cut).not.toBeNull();
      expect(Math.abs(total(cut!) - (1 - s - e) * T)).toBeLessThanOrEqual(1e-4 * T);
    }), RUNS);
    met.atLeast(0.2, RUNS.numRuns);
  }, timeoutFor(200, 10));
});
