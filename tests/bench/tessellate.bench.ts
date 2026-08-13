/**
 * Path tessellation: `tessellate()` against curve count and flatten
 * tolerance, plus the mesh cache's hit/miss split.
 *
 * `getMesh` is the route the renderer takes for polygon fills. A hit is a
 * `WeakMap` lookup; a miss is a full `tessellate`. Both are measured, because
 * the gap between them is the whole reason the cache exists — and first paint
 * pays the miss for every path on screen.
 */
import { bench, describe } from 'vitest';
import { tessellate } from 'features/paths/tessellate/tessellate';
import { tessellateStroke } from 'features/paths/tessellate/stroke';
// Relative: core's `renderer/` tree has no bare path mapping (nothing inside
// core imports it by one), so there is no alias to lean on here.
import { getMesh, _resetCacheForTests } from '../../packages/core/src/renderer/cache/cache';
import { curvyPath, rectPath } from './fixtures';

const CURVE_COUNTS = [8, 64, 512];
const TOLERANCES = [0.05, 0.25, 0.5, 2];

// Built once, outside the timed region: fixture construction is not the
// thing under test.
const paths = new Map(CURVE_COUNTS.map((n) => [n, curvyPath(n)]));

describe('tessellate — curve count (default tolerance 0.5)', () => {
  for (const n of CURVE_COUNTS) {
    const path = paths.get(n)!;
    bench(`${n} cubics`, () => {
      tessellate(path);
    });
  }
});

describe('tessellate — flatten tolerance (64 cubics)', () => {
  const path = paths.get(64)!;
  for (const tol of TOLERANCES) {
    bench(`tolerance ${tol}`, () => {
      tessellate(path, { flattenTolerance: tol });
    });
  }
});

describe('tessellate — rect fast path', () => {
  const r = rectPath(0, 0, 100, 60);
  bench('rect', () => {
    tessellate(r);
  });
});

describe('mesh cache — hit vs miss (64 cubics)', () => {
  const path = paths.get(64)!;
  // Warm once so the first timed iteration is already a hit.
  getMesh(path);
  bench('getMesh hit', () => {
    getMesh(path);
  });
  // The reset is a `new WeakMap()` — nanoseconds against a tessellation, but
  // it is inside the timed region because tinybench exposes no per-iteration
  // hook through vitest's `bench()`.
  bench('getMesh miss', () => {
    _resetCacheForTests();
    getMesh(path);
  });
});

describe('tessellateStroke — curve count', () => {
  const stroke = { paint: { fill: 'solid' as const, color: '#000' }, width: 4 };
  for (const n of CURVE_COUNTS) {
    const path = paths.get(n)!;
    bench(`${n} cubics`, () => {
      tessellateStroke(path, stroke);
    });
  }
});
