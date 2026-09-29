/**
 * Path tessellation: `tessellate()` against curve count and flatten
 * tolerance, plus the mesh cache's hit/miss split.
 *
 * `getMesh` is the route the renderer takes for polygon fills. A hit is a
 * `WeakMap` lookup; a miss is a full `tessellate`. Both are measured, because
 * the gap between them is the whole reason the cache exists — and first paint
 * pays the miss for every path on screen.
 */
import { group } from './group';
import { tessellate } from '@weasel-js/geom/tessellate';
import { tessellateStroke } from 'features/paths/tessellate/stroke';
// Relative: core's `renderer/` tree has no bare path mapping (nothing inside
// core imports it by one), so there is no alias to lean on here.
import { getMesh, _resetCacheForTests } from 'renderer/cache/cache';
import { curvyPath, rectPath } from './fixtures';

const CURVE_COUNTS = [8, 64, 512];
const TOLERANCES = [0.05, 0.25, 0.5, 2];

// Built once, outside the timed region: fixture construction is not the
// thing under test.
const paths = new Map(CURVE_COUNTS.map((n) => [n, curvyPath(n)]));

group('tessellate — curve count (default tolerance 0.5)', (bench) => {
  for (const n of CURVE_COUNTS) {
    const path = paths.get(n)!;
    bench(`${n} cubics`, () => {
      tessellate(path);
    });
  }
});

group('tessellate — flatten tolerance (64 cubics)', (bench) => {
  const path = paths.get(64)!;
  for (const tol of TOLERANCES) {
    bench(`tolerance ${tol}`, () => {
      tessellate(path, { flattenTolerance: tol });
    });
  }
});

group('tessellate — rect fast path', (bench) => {
  const r = rectPath(0, 0, 100, 60);
  bench('rect', () => {
    tessellate(r);
  });
});

group('mesh cache — hit vs miss (64 cubics)', (bench) => {
  const path = paths.get(64)!;
  // Warm once so the first timed iteration is already a hit.
  getMesh(path);
  bench('getMesh hit', () => {
    getMesh(path);
  });
  bench('getMesh miss', { beforeEach: _resetCacheForTests }, () => {
    getMesh(path);
  });
});

group('tessellateStroke — curve count', (bench) => {
  const stroke = { paint: { fill: 'solid' as const, color: '#000' }, width: 4 };
  for (const n of CURVE_COUNTS) {
    const path = paths.get(n)!;
    bench(`${n} cubics`, () => {
      tessellateStroke(path, stroke);
    });
  }
});
