/** How the rings of a fill that does not cross itself sit inside one another. */

import { pointInPolygon, ringSignedArea } from '../polyline';
import type { FlattenedContours } from './crossings';

export interface Ring {
  start: number;
  end: number;
  area: number;
  /** The smallest ring this one lies inside, or -1. */
  parent: number;
  /** Nonzero winding number just inside this ring. */
  winding: number;
}

/** Each contour's ring. A zero-area ring has no parent and winding 0. */
export function nestRings(flat: FlattenedContours): Ring[] {
  const { coords, contourStarts } = flat;
  const total = coords.length / 2;
  const rings: Ring[] = contourStarts.map((start, c) => {
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : total;
    return { start, end, area: ringSignedArea(coords, start, end), parent: -1, winding: 0 };
  });
  const boxes = rings.map((r) => boxOf(coords, r.start, r.end));
  const bySize = rings.map((_, i) => i).filter((i) => rings[i].area !== 0);
  bySize.sort((i, j) => Math.abs(rings[j].area) - Math.abs(rings[i].area));
  for (let k = 0; k < bySize.length; k++) {
    const r = rings[bySize[k]];
    for (let m = k - 1; m >= 0; m--) {
      const o = bySize[m];
      if (contains(coords, rings[o], boxes[o], r)) {
        r.parent = o;
        break;
      }
    }
    r.winding = Math.sign(r.area) + (r.parent >= 0 ? rings[r.parent].winding : 0);
  }
  return rings;
}

/** Whether `r` lies inside `o`, given that neither crosses the other. Judged
 *  at the first vertex of `r` not on `o`'s outline, since one on it is
 *  inside or out by rounding. */
function contains(coords: number[], o: Ring, box: number[], r: Ring): boolean {
  const eps = Math.max(box[2] - box[0], box[3] - box[1]) * 1e-9;
  for (let i = r.start; i < r.end; i++) {
    const x = coords[i * 2], y = coords[i * 2 + 1];
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return false;
    if (!onOutline(coords, o, x, y, eps)) return pointInPolygon(coords, x, y, o.start, o.end);
  }
  return false;
}

function onOutline(coords: number[], o: Ring, x: number, y: number, eps: number): boolean {
  for (let i = o.start; i < o.end; i++) {
    const j = i + 1 === o.end ? o.start : i + 1;
    const ax = coords[i * 2], ay = coords[i * 2 + 1];
    const dx = coords[j * 2] - ax, dy = coords[j * 2 + 1] - ay;
    const len2 = dx * dx + dy * dy;
    const s = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    if (Math.hypot(ax + dx * s - x, ay + dy * s - y) <= eps) return true;
  }
  return false;
}

function boxOf(coords: number[], start: number, end: number): number[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = start; i < end; i++) {
    const x = coords[i * 2], y = coords[i * 2 + 1];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

