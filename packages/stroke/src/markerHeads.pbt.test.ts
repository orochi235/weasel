import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Stroke } from '@weasel-js/paint';
import { markerHeads } from './markerHeads';
import { listMarkers } from './strokeMarkers';
import { eighth, pathOf, polyline, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = runs(200);
const key = fc.constantFrom(...listMarkers().map((m) => m.id));
const role = fc.option(key, { nil: undefined });

describe('markerHeads, property', () => {
  it('builds one finite head per site, and moves every head with a translated path', () => {
    const built = tally();
    const shape = fc.boolean().chain((c) => polyline({ closed: c, maxLength: 6 }).map((pts) => ({ pts, closed: c })));
    fc.assert(fc.property(shape, role, role, role, fc.integer({ min: 1, max: 40 }).map((n) => n / 4), eighth(), eighth(), (
      { pts, closed: c }, start, mid, end, width, tx, ty,
    ) => {
      const stroke: Stroke = { paint: { color: '#000' }, width, markerStart: start, markerMid: mid, markerEnd: end };
      const a = markerHeads(pathOf(pts, c), stroke, width, undefined);
      const b = markerHeads(pathOf(pts.map((p) => ({ x: p.x + tx, y: p.y + ty })), c), stroke, width, undefined);
      const ends = c ? 0 : (start ? 1 : 0) + (end ? 1 : 0);
      expect(a).toHaveLength(ends + (mid ? (c ? pts.length - 1 : pts.length - 2) : 0));
      expect(b).toHaveLength(a.length);
      if (a.length > 0) built.hit();
      a.forEach((h, i) => {
        const p = h.path.coords, q = b[i]!.path.coords;
        expect(q.length).toBe(p.length);
        for (let k = 0; k < p.length; k += 2) {
          expect(Number.isFinite(p[k]!) && Number.isFinite(p[k + 1]!)).toBe(true);
          const tol = 1e-3 * (1 + Math.abs(p[k]!) + Math.abs(p[k + 1]!) + Math.abs(tx) + Math.abs(ty));
          expect(Math.abs(q[k]! - p[k]! - tx)).toBeLessThanOrEqual(tol);
          expect(Math.abs(q[k + 1]! - p[k + 1]! - ty)).toBeLessThanOrEqual(tol);
        }
      });
    }), RUNS);
    built.atLeast(0.5, RUNS.numRuns);
  }, timeoutFor(200, 5));
});
