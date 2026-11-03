/** One segment of a run, given as flat control points, `dim` components each: two for a line, three for a quadratic, four for a cubic. */

/** The point at parameter `t`, three components, those past `dim` 0. */
export function bezierPoint(c: ArrayLike<number>, dim: number, t: number): [number, number, number] {
  const n = c.length / dim - 1;
  const u = 1 - t;
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < dim; k++) {
    out[k] = n === 1 ? u * c[k] + t * c[dim + k]
      : n === 2 ? u * u * c[k] + 2 * u * t * c[dim + k] + t * t * c[2 * dim + k]
        : u * u * u * c[k] + 3 * u * u * t * c[dim + k] + 3 * u * t * t * c[2 * dim + k] + t * t * t * c[3 * dim + k];
  }
  return out;
}

/** The unit direction of travel at parameter `t`, or null where the derivative vanishes. */
export function bezierDirection(c: ArrayLike<number>, dim: number, t: number): [number, number, number] | null {
  const n = c.length / dim - 1;
  const u = 1 - t;
  // The derivative is the degree-lower curve through the control points' differences.
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < dim; k++) {
    const d0 = c[dim + k] - c[k];
    const v = n === 1 ? d0
      : n === 2 ? u * d0 + t * (c[2 * dim + k] - c[dim + k])
        : u * u * d0 + 2 * u * t * (c[2 * dim + k] - c[dim + k]) + t * t * (c[3 * dim + k] - c[2 * dim + k]);
    if (k === 0) x = v; else if (k === 1) y = v; else z = v;
  }
  const l = Math.sqrt(x * x + y * y + z * z);
  return l > 0 ? [x / l, y / l, z / l] : null;
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
