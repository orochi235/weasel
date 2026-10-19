/** Finding where straight segments cross, by a sweep along x. */

const LOW_WORD = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 0 : 1;
/** How far, relative to itself, writing an index into a key's low word can
 *  move it. A zero key becomes a subnormal, which the sweep's 1e-300 covers. */
const KEY_SLACK = 2 ** -19;

/**
 * Call `visit` for every pair of segments that cross inside both, with how far
 * along each the crossing lies; `visit` returns `true` to stop. `ends` holds
 * `n` segments as `x0, y0, x1, y1`. Of each pair, `e` is the one whose
 * smallest x is smaller.
 */
export function forEachCrossing(
  ends: Float64Array,
  n: number,
  visit: (e: number, f: number, s: number, u: number) => boolean | void,
): void {
  const keys = sortedMinX(ends, n);
  const index = new Uint32Array(keys.buffer);
  for (let i = 0; i < n; i++) {
    const ei = index[i * 2 + LOW_WORD], e = ei * 4;
    const ex0 = ends[e], ey0 = ends[e + 1], ex1 = ends[e + 2], ey1 = ends[e + 3];
    const maxX = Math.max(ex0, ex1);
    const stop = maxX + Math.abs(maxX) * KEY_SLACK + 1e-300;
    for (let j = i + 1; j < n; j++) {
      if (keys[j] > stop) break;
      const fi = index[j * 2 + LOW_WORD], f = fi * 4;
      const fx0 = ends[f], fy0 = ends[f + 1], fx1 = ends[f + 2], fy1 = ends[f + 3];
      if (Math.max(ey0, ey1) < Math.min(fy0, fy1)) continue;
      if (Math.max(fy0, fy1) < Math.min(ey0, ey1)) continue;
      const hit = crossingParams(ex0, ey0, ex1, ey1, fx0, fy0, fx1, fy1);
      if (hit && visit(ei, fi, hit[0], hit[1])) return;
    }
  }
}

/**
 * Each segment's smallest x in ascending order, with the segment's index
 * written into the key's low 32 bits, read back through a `Uint32Array` view.
 * A native numeric sort runs about three times as fast as one through a
 * comparator; the index moves each key by under `KEY_SLACK` of itself, which
 * the sweep's stop allows for.
 */
function sortedMinX(ends: Float64Array, n: number): Float64Array {
  const keys = new Float64Array(n);
  const index = new Uint32Array(keys.buffer);
  for (let e = 0; e < n; e++) {
    keys[e] = Math.min(ends[e * 4], ends[e * 4 + 2]);
    index[e * 2 + LOW_WORD] = e;
  }
  return keys.sort();
}

/** Where segment E crosses segment F inside both, as fractions along each. */
function crossingParams(
  ex0: number, ey0: number, ex1: number, ey1: number,
  fx0: number, fy0: number, fx1: number, fy1: number,
): [number, number] | null {
  const rx = ex1 - ex0, ry = ey1 - ey0;
  const qx = fx1 - fx0, qy = fy1 - fy0;
  const den = rx * qy - ry * qx;
  if (den === 0) return null;
  const dx = fx0 - ex0, dy = fy0 - ey0;
  const s = (dx * qy - dy * qx) / den;
  const u = (dx * ry - dy * rx) / den;
  const lo = 1e-9, hi = 1 - 1e-9;
  if (s <= lo || s >= hi || u <= lo || u >= hi) return null;
  return [s, u];
}
