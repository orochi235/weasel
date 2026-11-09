/** One segment of a run, given as flat control points, `dim` components each: two for a line, three for a quadratic, four for a cubic. */

/** The point at parameter `t`, three components, those past `dim` 0; written into `out` when given. */
export function bezierPoint(
  c: ArrayLike<number>, dim: number, t: number, out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const n = c.length / dim - 1;
  const u = 1 - t;
  if (dim === 2) out[2] = 0;
  if (n === 3) {
    const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
    for (let k = 0; k < dim; k++) out[k] = w0 * c[k] + w1 * c[dim + k] + w2 * c[2 * dim + k] + w3 * c[3 * dim + k];
  } else if (n === 2) {
    const w0 = u * u, w1 = 2 * u * t, w2 = t * t;
    for (let k = 0; k < dim; k++) out[k] = w0 * c[k] + w1 * c[dim + k] + w2 * c[2 * dim + k];
  } else {
    for (let k = 0; k < dim; k++) out[k] = u * c[k] + t * c[dim + k];
  }
  return out;
}

/** The unit direction of travel at parameter `t`, or null where the derivative vanishes inside the curve. At an
 *  end whose handle is retracted, the curve's limit: toward the nearest control point apart from that end. */
export function bezierDirection(c: ArrayLike<number>, dim: number, t: number): [number, number, number] | null {
  const d = derivativeDirection(c, dim, t);
  if (d || (t > 0 && t < 1)) return d;
  const n = c.length / dim - 1;
  for (let j = 1; j <= n; j++) {
    const v = t <= 0 ? difference(c, dim, 0, j) : difference(c, dim, n - j, n);
    if (v) return v;
  }
  return null;
}

/** The unit vector from control point `a` to control point `b`, or null when they coincide. */
function difference(c: ArrayLike<number>, dim: number, a: number, b: number): [number, number, number] | null {
  const z = dim === 3 ? c[b * dim + 2] - c[a * dim + 2] : 0;
  return unit(c[b * dim] - c[a * dim], c[b * dim + 1] - c[a * dim + 1], z);
}

function unit(x: number, y: number, z: number): [number, number, number] | null {
  const l = Math.sqrt(x * x + y * y + z * z);
  return l > 0 ? [x / l, y / l, z / l] : null;
}

function derivativeDirection(c: ArrayLike<number>, dim: number, t: number): [number, number, number] | null {
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
  return unit(x, y, z);
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
