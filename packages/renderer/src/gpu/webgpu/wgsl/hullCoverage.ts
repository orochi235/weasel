import { HULL_ORIGIN_BIAS, HULL_ORIGIN_SPAN, HULL_PLANES, HULL_POOL, HULL_UNITS } from '../../../batchHull';

const SETTLED = (2 ** 30).toFixed(1);

/**
 * `HULL_COVERAGE_GLSL` in WGSL. The planes are in GL's window space, from the
 * target's bottom left, so the fragment's top-left position is turned over
 * with `u_targetHeight`, the height in device pixels of the target drawn into,
 * which the draw code sets beside `u_hullPlanes`.
 */
export const HULL_MEMBERS = [`u_hullPlanes: array<vec4i, ${HULL_POOL}>`, 'u_targetHeight: i32'] as const;

export const HULL_COVERAGE_WGSL = /* wgsl */ `
fn hullCoverage(position: vec2f, start: i32, count: i32) -> f32 {
  let pixel = vec2i(i32(position.x), u.u_targetHeight - 1 - i32(position.y));
  for (var k = 0; k < ${HULL_PLANES}; k++) {
    if (k >= count) { break; }
    let p = u.u_hullPlanes[start + k];
    let origin = vec2i(p.w % ${HULL_ORIGIN_SPAN}, p.w / ${HULL_ORIGIN_SPAN}) - ${HULL_ORIGIN_BIAS};
    let d = (pixel - origin) * ${HULL_UNITS} + ${HULL_UNITS / 2};
    let estimate = f32(p.x) * f32(d.x) + f32(p.y) * f32(d.y) + f32(p.z);
    if (estimate < -${SETTLED}) { return 0.0; }
    if (estimate < ${SETTLED}) {
      let e = bitcast<u32>(p.x) * bitcast<u32>(d.x) + bitcast<u32>(p.y) * bitcast<u32>(d.y) + bitcast<u32>(p.z);
      if (bitcast<i32>(e) < 0) { return 0.0; }
    }
  }
  return 1.0;
}
`;
