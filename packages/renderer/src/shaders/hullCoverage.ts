/**
 * GLSL for the batch program's hull clip: whether a fragment's pixel center
 * lies inside the half-planes its vertex names. See `batchHull.ts` for how the
 * planes are built and why the test is exact.
 *
 * The test is in integers, because the stencil it has to agree with is: a
 * float misjudges a center a few millionths of a pixel from a long edge. A
 * plane's products overflow 32 bits far from its line, so a float estimate
 * settles every fragment it can, and only those near the line, where the
 * exact value fits, take the integer path. Unsigned arithmetic, because its
 * wraparound is defined: the low 32 bits come out right whatever the
 * intermediate products did.
 */

import { HULL_ORIGIN_BIAS, HULL_ORIGIN_SPAN, HULL_PLANES, HULL_POOL, HULL_UNITS } from '../batchHull';

/** Past this an estimate's sign is certain: its error is under 2^23 for any
 *  plane `batchHull.ts` builds, and an exact value under 2^31 fits an int. */
const SETTLED = (2 ** 30).toFixed(1);

export const HULL_COVERAGE_GLSL = /* glsl */ `
uniform ivec4 u_hullPlanes[${HULL_POOL}];
flat in int v_hullStart;
flat in int v_hullCount;
float hullCoverage() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  for (int k = 0; k < ${HULL_PLANES}; k++) {
    if (k >= v_hullCount) break;
    ivec4 p = u_hullPlanes[v_hullStart + k];
    ivec2 origin = ivec2(p.w % ${HULL_ORIGIN_SPAN}, p.w / ${HULL_ORIGIN_SPAN}) - ${HULL_ORIGIN_BIAS};
    ivec2 d = (pixel - origin) * ${HULL_UNITS} + ${HULL_UNITS / 2};
    float estimate = float(p.x) * float(d.x) + float(p.y) * float(d.y) + float(p.z);
    if (estimate < -${SETTLED}) return 0.0;
    if (estimate < ${SETTLED}) {
      uint e = uint(p.x) * uint(d.x) + uint(p.y) * uint(d.y) + uint(p.z);
      if (int(e) < 0) return 0.0;
    }
  }
  return 1.0;
}
`;
