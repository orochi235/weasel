/** Even-odd fills whose outlines never meet, which triangulate like nonzero ones. */

import type { FlattenedContours } from './crossings';
import { nestRings, type Ring } from './nesting';

/**
 * The rings of an even-odd fill with each `winding` set to 1 where the fill
 * lies just inside it and 0 where a hole does, or `null` when two edges touch
 * anywhere but the vertex two neighbors share, or a ring has no area. Without
 * contact, each ring is filled or empty by how many rings enclose it, so the
 * fill is the even-depth rings less their children and earcut can draw it.
 * Contact is judged with a tolerance, so a near miss reads as a touch.
 */
export function evenOddRings(flat: FlattenedContours): Ring[] | null {
  if (anyContact(flat)) return null;
  const rings = nestRings(flat);
  if (rings.some((r) => r.area === 0)) return null;
  for (const r of rings) {
    let depth = 0;
    for (let p = r.parent; p >= 0; p = rings[p].parent) depth++;
    r.winding = depth % 2 === 0 ? 1 : 0;
  }
  return rings;
}

/** Segments as `x0, y0, x1, y1`, with each one's contour and position in it. */
interface Segments {
  ends: Float64Array;
  contour: Uint32Array;
  pos: Uint32Array;
  /** Segments in each contour. */
  count: number[];
  n: number;
}

function segmentsOf(flat: FlattenedContours): Segments {
  const { coords, contourStarts } = flat;
  const total = coords.length / 2;
  const ends = new Float64Array(total * 4);
  const contour = new Uint32Array(total);
  const pos = new Uint32Array(total);
  const count: number[] = [];
  let n = 0;
  contourStarts.forEach((start, c) => {
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : total;
    let k = 0;
    for (let i = start; i < end; i++) {
      const j = i + 1 < end ? i + 1 : start;
      const x0 = coords[i * 2], y0 = coords[i * 2 + 1], x1 = coords[j * 2], y1 = coords[j * 2 + 1];
      if (x0 === x1 && y0 === y1) continue;
      ends.set([x0, y0, x1, y1], n * 4);
      contour[n] = c;
      pos[n] = k++;
      n++;
    }
    count.push(k);
  });
  return { ends, contour, pos, count, n };
}

/** Whether any two segments meet other than at the end two neighbors share. */
function anyContact(flat: FlattenedContours): boolean {
  const s = segmentsOf(flat);
  const { ends, n } = s;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n * 4; i += 2) {
    minX = Math.min(minX, ends[i]); maxX = Math.max(maxX, ends[i]);
    minY = Math.min(minY, ends[i + 1]); maxY = Math.max(maxY, ends[i + 1]);
  }
  const eps = Math.max(maxX - minX, maxY - minY, Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY)) * 1e-9;
  const order = Array.from({ length: n }, (_, i) => i);
  const lo = (e: number): number => Math.min(ends[e * 4], ends[e * 4 + 2]);
  order.sort((a, b) => lo(a) - lo(b));
  for (let a = 0; a < n; a++) {
    const e = order[a];
    const stop = Math.max(ends[e * 4], ends[e * 4 + 2]) + eps;
    for (let b = a + 1; b < n; b++) {
      const f = order[b];
      if (lo(f) > stop) break;
      if (touches(s, e, f, eps)) return true;
    }
  }
  return false;
}

function touches(s: Segments, e: number, f: number, eps: number): boolean {
  const { ends } = s;
  const ax = ends[e * 4], ay = ends[e * 4 + 1], bx = ends[e * 4 + 2], by = ends[e * 4 + 3];
  const cx = ends[f * 4], cy = ends[f * 4 + 1], dx = ends[f * 4 + 2], dy = ends[f * 4 + 3];
  if (Math.max(ay, by) + eps < Math.min(cy, dy) || Math.max(cy, dy) + eps < Math.min(ay, by)) return false;
  const shared = sharedEnd(s, e, f);
  if (shared === 'e-to') {
    // f starts where e ends: they meet only there unless f doubles back along e.
    return foldsBack(bx - ax, by - ay, dx - cx, dy - cy) || near(ax, ay, cx, cy, dx, dy, eps);
  }
  if (shared === 'f-to') {
    return foldsBack(dx - cx, dy - cy, bx - ax, by - ay) || near(cx, cy, ax, ay, bx, by, eps);
  }
  return near(ax, ay, cx, cy, dx, dy, eps) || near(bx, by, cx, cy, dx, dy, eps)
    || near(cx, cy, ax, ay, bx, by, eps) || near(dx, dy, ax, ay, bx, by, eps)
    || properCross(ax, ay, bx, by, cx, cy, dx, dy);
}

/** Which of the pair hands its end to the other as its start, when they are
 *  neighbors in one contour. A contour of two segments has them meet at both
 *  ends, and is caught for having no area. */
function sharedEnd(s: Segments, e: number, f: number): 'e-to' | 'f-to' | null {
  if (s.contour[e] !== s.contour[f]) return null;
  const k = s.count[s.contour[e]];
  if (k < 3) return null;
  if ((s.pos[e] + 1) % k === s.pos[f]) return 'e-to';
  if ((s.pos[f] + 1) % k === s.pos[e]) return 'f-to';
  return null;
}

/** Whether the second direction turns back along the first. */
function foldsBack(ux: number, uy: number, vx: number, vy: number): boolean {
  const cross = ux * vy - uy * vx;
  return Math.abs(cross) <= 1e-9 * Math.hypot(ux, uy) * Math.hypot(vx, vy) && ux * vx + uy * vy < 0;
}

/** Whether point P lies within `eps` of segment AB. */
function near(px: number, py: number, ax: number, ay: number, bx: number, by: number, eps: number): boolean {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py) <= eps;
}

function properCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  return o1 * o2 <= 0 && o3 * o4 <= 0;
}

const orient = (ax: number, ay: number, bx: number, by: number, px: number, py: number): number =>
  Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
