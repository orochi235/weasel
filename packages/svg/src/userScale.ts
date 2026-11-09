/**
 * How much a stroke read during a parse has been scaled since its element's
 * own user space: the transforms baked into it. Its marker references are
 * still ids then, and a `userSpaceOnUse` marker, or one sized in user units,
 * scales with that transform as a browser draws it, which `ingestMarkers`
 * reads once the tree is built.
 */

const scales = new WeakMap<object, number>();

/** The factor `stroke`'s lengths were scaled by since they were read; 1 when never. */
export function userScaleOf(stroke: object): number {
  return scales.get(stroke) ?? 1;
}

/** `to`, a copy of `from` with its lengths scaled `by` further, carrying the factor `from` holds. */
export function carryUserScale<T extends object>(from: object, to: T, by = 1): T {
  const s = userScaleOf(from) * by;
  if (s !== 1) scales.set(to, s);
  return to;
}
