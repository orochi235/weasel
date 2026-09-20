/**
 * The cubic control points that make a curve leave a port along its normal and
 * arrive at the next against that port's normal — what makes a routed edge read
 * as plugged into a box rather than aimed at it.
 *
 * The rule is stated once, over loose components, and the 2D barrel and `./3d`
 * each wrap it in their own currency. Every operation here is closed on the
 * plane z = 0, so a planar problem answered through the 3D wrapper returns the
 * same numbers as through the 2D one, not an approximation of them.
 */

/** How far a control point reaches toward the other end, as a fraction of the
 *  straight-line distance between the two. */
export const PORT_REACH = 0.4;

/**
 * `[c1, c2]` for the cubic from `a` to `b`.
 *
 * A null normal falls back to a plain lerp along the chord, which is what makes
 * an unported waypoint curve smoothly instead of kinking. The two ends are not
 * symmetric: `outNormal` points the way the curve departs, while `inNormal`
 * points out of the receiving port, so `c2` is pushed *along* it to arrive
 * against it.
 */
export function portControls(
  a: readonly number[],
  b: readonly number[],
  outNormal: readonly number[] | null | undefined,
  inNormal: readonly number[] | null | undefined,
  reach: number = PORT_REACH,
): [number[], number[]] {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = b[i]! - a[i]!;
    sum += d * d;
  }
  const span = Math.sqrt(sum) * reach;

  const c1: number[] = [];
  const c2: number[] = [];
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    c1.push(outNormal == null ? ai + (bi - ai) * reach : ai + outNormal[i]! * span);
    c2.push(inNormal == null ? bi - (bi - ai) * reach : bi + inNormal[i]! * span);
  }
  return [c1, c2];
}

/** A cubic evaluated at `t`, component-wise, in whatever dimension it was given. */
export function cubicAt(
  p0: readonly number[],
  p1: readonly number[],
  p2: readonly number[],
  p3: readonly number[],
  t: number,
): number[] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  const out: number[] = [];
  for (let i = 0; i < p0.length; i++) {
    out.push(a * p0[i]! + b * p1[i]! + c * p2[i]! + d * p3[i]!);
  }
  return out;
}
