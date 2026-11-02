/** One segment of a run, given as flat control points, `dim` components each: two for a line, three for a quadratic, four for a cubic. */

/** The point at parameter `t`, three components, those past `dim` 0. */
export function bezierPoint(c: ArrayLike<number>, dim: number, t: number): [number, number, number] {
  const n = c.length / dim - 1;
  const u = 1 - t;
  const w = n === 1 ? [u, t] : n === 2 ? [u * u, 2 * u * t, t * t] : [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < dim; k++) {
    let v = 0;
    for (let i = 0; i <= n; i++) v += w[i] * c[i * dim + k];
    out[k] = v;
  }
  return out;
}

/** The unit direction of travel at parameter `t`, or null where the derivative vanishes. */
export function bezierDirection(c: ArrayLike<number>, dim: number, t: number): [number, number, number] | null {
  const n = c.length / dim - 1;
  const u = 1 - t;
  // The derivative is the degree-lower curve through the control points' differences.
  const w = n === 1 ? [1] : n === 2 ? [u, t] : [u * u, 2 * u * t, t * t];
  const d: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < dim; k++) {
    let v = 0;
    for (let i = 0; i < n; i++) v += w[i] * (c[(i + 1) * dim + k] - c[i * dim + k]);
    d[k] = v;
  }
  const l = Math.hypot(d[0], d[1], d[2]);
  return l > 0 ? [d[0] / l, d[1] / l, d[2] / l] : null;
}

/** Segment `i` of a run, from point `i` to the next (a closed run's closing edge wrapping to its first), its controls between. */
export function segmentCoords(
  points: ArrayLike<number>, controls: ArrayLike<number> | null | undefined, dim: number, i: number,
): number[] {
  const n = Math.floor(points.length / dim);
  const a = i * dim;
  const b = ((i + 1) % n) * dim;
  const out: number[] = [];
  for (let k = 0; k < dim; k++) out.push(points[a + k]);
  if (controls) for (let k = 0; k < controls.length; k++) out.push(controls[k]);
  for (let k = 0; k < dim; k++) out.push(points[b + k]);
  return out;
}
