/**
 * The cubic control points that make a curve leave a port along its normal and
 * arrive at the next against that port's normal — what makes a routed edge read
 * as plugged into a box rather than aimed at it.
 *
 * The rule is stated once, over loose components, and published as is from
 * `./nd`; the 2D barrel and `./3d` each wrap it in their own currency. Every
 * operation here is closed on the plane z = 0, so a planar problem answered
 * through the 3D wrapper returns the same numbers as through the 2D one, not an
 * approximation of them.
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
  let span = Math.sqrt(sum) * reach;
  if (!Number.isFinite(span)) span = Math.min(farChord(a, b) * reach, Number.MAX_VALUE);

  const c1: number[] = [];
  const c2: number[] = [];
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    c1.push(outNormal == null ? toward(ai, bi, reach) : held(ai + outNormal[i]! * span));
    c2.push(inNormal == null ? toward(bi, ai, reach) : held(bi + inNormal[i]! * span));
  }
  return [c1, c2];
}

/** The distance from `a` to `b` where its square passes the double range, as far as a double holds it. */
function farChord(a: readonly number[], b: readonly number[]): number {
  let scale = 0;
  for (let i = 0; i < a.length; i++) scale = Math.max(scale, Math.abs(b[i]! / 2 - a[i]! / 2));
  if (scale === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += ((b[i]! / 2 - a[i]! / 2) / scale) ** 2;
  return Math.min(scale * Math.sqrt(sum) * 2, Number.MAX_VALUE);
}

/** `from` moved fraction `t` of the way to `to`, finite wherever both are. */
function toward(from: number, to: number, t: number): number {
  const v = from + (to - from) * t;
  return Number.isFinite(v) ? v : from * (1 - t) + to * t;
}

/** `v` held to the double range. */
const held = (v: number): number => Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, v));

/** A port curve sampled into `samples` points, excluding its start. */
export function portCurvePoints(
  a: readonly number[],
  b: readonly number[],
  outNormal: readonly number[] | null | undefined,
  inNormal: readonly number[] | null | undefined,
  samples: number,
  reach: number = PORT_REACH,
): number[][] {
  const [c1, c2] = portControls(a, b, outNormal, inNormal, reach);
  const out: number[][] = [];
  for (let s = 1; s <= samples; s++) out.push(cubicPointAt(a, c1, c2, b, s / samples));
  return out;
}

/** A cubic evaluated at `t`, component-wise, in whatever dimension it was given. */
export function cubicPointAt(
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
    const v = a * p0[i]! + b * p1[i]! + c * p2[i]! + d * p3[i]!;
    // Points near the double range's ends can round a sum past it.
    out.push(Number.isFinite(v) ? v : held(2 * (a * (p0[i]! / 2) + b * (p1[i]! / 2) + c * (p2[i]! / 2) + d * (p3[i]! / 2))));
  }
  return out;
}
