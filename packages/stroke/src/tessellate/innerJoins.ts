/**
 * Where two segments of a ribbon meet on the inside of a turn, their quads
 * overlap past the corner, and a translucent stroke drawn from them blends
 * twice there. This moves the inner corner of each pair to where their inner
 * edges cross, so the quads meet along one edge instead, and the join is
 * drawn as a fan from that point.
 *
 * Where the crossing lies past either segment's far end, or would carry a
 * segment's inner edge past where its other end's join already moved it, the
 * pair keeps its corners and still overlaps: a stroke turning tighter than
 * its own half-width covers that ground twice by construction.
 */
import type { Seg } from './ribbon';

/** `segs[k]`'s inner edge on the side `side` (0 the +n edge, 1 the −n) runs
 *  from vertex `base + side` to `base + 2 + side`. */
interface Meet {
  side: 0 | 1;
  x: number;
  y: number;
  /** How far along `a`'s inner edge the crossing lies, 0 at its start. */
  s: number;
  /** How far along `b`'s, 0 at its start. */
  u: number;
}

/**
 * For each join `j` (between `segs[j]` and the next), the index of the vertex
 * its fan is drawn from, both inner corners having been moved onto it in
 * `verts`, or -1 where the corners were left alone.
 */
export function meetInnerEdges(segs: Seg[], segBaseIdx: number[], closed: boolean, verts: number[]): number[] {
  const n = segs.length;
  const joins = closed ? n : n - 1;
  const meets: (Meet | null)[] = [];
  for (let j = 0; j < joins; j++) meets.push(meetAt(segs, segBaseIdx, j, verts));

  // A segment whose two ends were both moved along the same edge must not
  // have them pass each other; drop the join on either side until none do.
  for (let changed = true; changed;) {
    changed = false;
    for (let k = 0; k < n; k++) {
      const before = k > 0 || closed ? meets[(k - 1 + n) % n] ?? null : null;
      const after = k < joins ? meets[k] : null;
      if (before && after && before.side === after.side && before.u > after.s) {
        meets[(k - 1 + n) % n] = null;
        meets[k] = null;
        changed = true;
      }
    }
  }

  const pivots: number[] = [];
  for (let j = 0; j < joins; j++) {
    const m = meets[j];
    if (!m) { pivots.push(-1); continue; }
    const aEnd = segBaseIdx[j] + 2 + m.side;
    const bStart = segBaseIdx[(j + 1) % n] + m.side;
    verts[aEnd * 2] = m.x; verts[aEnd * 2 + 1] = m.y;
    verts[bStart * 2] = m.x; verts[bStart * 2 + 1] = m.y;
    pivots.push(aEnd);
  }
  return pivots;
}

function meetAt(segs: Seg[], segBaseIdx: number[], j: number, verts: number[]): Meet | null {
  const a = segs[j];
  const b = segs[(j + 1) % segs.length];
  const cross = (a.bx - a.ax) * (b.by - b.ay) - (a.by - a.ay) * (b.bx - b.ax);
  if (cross === 0) return null;
  // Turning toward +n, the inside of the turn is the +n edge.
  const side: 0 | 1 = cross > 0 ? 0 : 1;
  const aBase = segBaseIdx[j], bBase = segBaseIdx[(j + 1) % segs.length];
  const p0x = verts[(aBase + side) * 2], p0y = verts[(aBase + side) * 2 + 1];
  const p1x = verts[(aBase + 2 + side) * 2], p1y = verts[(aBase + 2 + side) * 2 + 1];
  const q0x = verts[(bBase + side) * 2], q0y = verts[(bBase + side) * 2 + 1];
  const q1x = verts[(bBase + 2 + side) * 2], q1y = verts[(bBase + 2 + side) * 2 + 1];
  const rx = p1x - p0x, ry = p1y - p0y;
  const qx = q1x - q0x, qy = q1y - q0y;
  const den = rx * qy - ry * qx;
  if (den === 0) return null;
  const dx = q0x - p0x, dy = q0y - p0y;
  const s = (dx * qy - dy * qx) / den;
  const u = (dx * ry - dy * rx) / den;
  if (!(s > 0 && s <= 1 && u >= 0 && u < 1)) return null;
  return { side, x: p0x + rx * s, y: p0y + ry * s, s, u };
}
