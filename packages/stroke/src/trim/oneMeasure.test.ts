import { describe, expect, it } from 'vitest';
import { cubicEvalAt, pathFromD, segmentLength, segmentTAtLength, strokeHitTest, type PolygonPath } from '@weasel-js/geom';
import type { Stroke, StrokeTrim } from '@weasel-js/paint';
import { tessellateStroke } from '../tessellate/stroke';
import { trimSpan } from './trimSpan';
import { trimmedPath } from './trimmedPath';

// x rises monotonically along it, so the ribbon's end is its rightmost vertex.
const C = [0, 0, 20, 90, 120, -60, 200, 40];
const CUBIC = pathFromD(`M${C[0]} ${C[1]} C${C.slice(2).join(' ')}`) as PolygonPath;
const BASE: Stroke = { paint: { kind: 'solid', color: '#000' }, width: 1e-4, cap: 'butt' };

/** The exact point `length` along the cubic. */
function exactAt(length: number): [number, number] {
  return cubicEvalAt(C[0], C[1], C[2], C[3], C[4], C[5], C[6], C[7], segmentTAtLength(C, 2, length));
}

function ribbonEnd(trim: StrokeTrim, flattenTolerance: number): [number, number] {
  const v = tessellateStroke(CUBIC, { ...BASE, trim }, { flattenTolerance }).vertices;
  let best = 0;
  for (let i = 2; i < v.length; i += 2) if (v[i] > v[best]) best = i;
  return [v[best], v[best + 1]];
}

function exportEnd(trim: StrokeTrim): [number, number] {
  const { coords } = trimmedPath(CUBIC, trim)!.path as PolygonPath;
  return [coords[coords.length - 2], coords[coords.length - 1]];
}

const near = (a: readonly number[], b: readonly number[], tol: number) =>
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(tol);

const TOTAL = segmentLength(C, 2);
const cases: [string, StrokeTrim, number][] = [
  ['a length', { end: { length: 137 } }, 137],
  ['a fraction', { end: 0.37 }, 0.37 * TOTAL],
];

describe('one trim measure for every reader', () => {
  for (const [name, trim, length] of cases) {
    it(`cut does not move with zoom (${name})`, () => {
      const exact = exactAt(length);
      near(ribbonEnd(trim, 2), exact, 1e-3);
      near(ribbonEnd(trim, 0.005), exact, 1e-3);
    });

    it(`canvas, picking and export cut at one point (${name})`, () => {
      const exact = exactAt(length);
      near(ribbonEnd(trim, 0.5), exact, 1e-3);
      near(exportEnd(trim), exact, 1e-3);
      // A coarse pick still ends its last capsule on the exact point, and not past it.
      const span = trimSpan(CUBIC, trim)!;
      expect(strokeHitTest(CUBIC, exact[0], exact[1], 1e-4, { span, flattenTolerance: 2 })).toBe(true);
      const t = segmentTAtLength(C, 2, length);
      const ahead = cubicEvalAt(C[0], C[1], C[2], C[3], C[4], C[5], C[6], C[7], Math.min(1, t + 3e-3 / 150));
      const gap = Math.hypot(ahead[0] - exact[0], ahead[1] - exact[1]);
      expect(gap).toBeGreaterThan(1e-3);
      expect(strokeHitTest(CUBIC, ahead[0], ahead[1], gap / 3, { span, flattenTolerance: 1e-4 })).toBe(false);
    });
  }
});
