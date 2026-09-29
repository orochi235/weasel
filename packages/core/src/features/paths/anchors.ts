/**
 * Counts the path anchors used by the per-anchor coloring surface. An
 * "anchor" is the destination point of a path command: M, L, C, Q each
 * contribute one (the (x, y) where the pen ends up); Z contributes none
 * (it closes back to the subpath's first M). RectPath has four implicit
 * anchors — the corners — matching its M/L/L/L/Z stroke tessellation.
 *
 * Consumers use this to size their per-anchor color array; the renderer
 * uses it to validate the array length in dev builds.
 */

import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  type PolygonPath,
  forEachSegment,
  nearestOnCubic,
  nearestOnLine,
  PathBuilder,
} from '@weasel-js/geom';

/** One anchor of an editable path: its on-curve point plus the two control
 *  handles that shape the segments either side of it. Handles are in the same
 *  space as the point, and absent when the adjoining segment is straight. */
export interface PenAnchor {
  x: number;
  y: number;
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
}

/**
 * Derive a per-subpath anchor model from a PolygonPath. Subpaths split on
 * every `M` command; a subpath is closed iff it ends with `Z`.
 *
 * Cubic-segment control points become the outHandle of the previous anchor
 * and the inHandle of the next anchor. Quadratic segments are upgraded to
 * cubics (each control reused for both adjacent handles) — this loses no
 * geometry. Linear segments produce anchors with no handles.
 */
export function pathToAnchors(
  path: PolygonPath,
): { anchors: PenAnchor[][]; closed: boolean[] } {
  const { commands, coords } = path;
  const anchors: PenAnchor[][] = [];
  const closed: boolean[] = [];
  let current: PenAnchor[] | null = null;

  forEachSegment(commands, coords, (cmd, ci) => {
    switch (cmd) {
      case PATH_M: {
        if (current) { anchors.push(current); closed.push(false); }
        current = [{ x: coords[ci], y: coords[ci + 1] }];
        break;
      }
      case PATH_L: {
        if (!current) throw new Error('pathToAnchors: L without prior M');
        current.push({ x: coords[ci], y: coords[ci + 1] });
        break;
      }
      case PATH_C: {
        if (!current) throw new Error('pathToAnchors: C without prior M');
        const prev = current[current.length - 1];
        prev.outHandle = { x: coords[ci], y: coords[ci + 1] };
        current.push({
          x: coords[ci + 4], y: coords[ci + 5],
          inHandle: { x: coords[ci + 2], y: coords[ci + 3] },
        });
        break;
      }
      case PATH_Q: {
        if (!current) throw new Error('pathToAnchors: Q without prior M');
        // Quadratic → cubic: handle is the same control point on both sides.
        const handle = { x: coords[ci], y: coords[ci + 1] };
        const prev = current[current.length - 1];
        prev.outHandle = handle;
        current.push({ x: coords[ci + 2], y: coords[ci + 3], inHandle: { ...handle } });
        break;
      }
      case PATH_Z: {
        if (current) { anchors.push(current); closed.push(true); current = null; }
        break;
      }
      default:
        throw new Error(`pathToAnchors: unknown command ${cmd}`);
    }
  });
  if (current) { anchors.push(current); closed.push(false); }
  return { anchors, closed };
}

/**
 * Serialize the per-subpath anchor model back to a PolygonPath. Inverse of
 * `pathToAnchors`. Curve-vs-line decision per segment:
 *   - Both adjacent handles absent → straight L segment.
 *   - Either handle present → C segment, with missing handles defaulting to
 *     the anchor point itself (degenerate but valid; renders as a near-line).
 */
export function anchorsToPath(
  anchors: PenAnchor[][],
  closed: boolean[],
): PolygonPath {
  const b = new PathBuilder();
  for (let s = 0; s < anchors.length; s++) {
    const sub = anchors[s];
    if (sub.length === 0) continue;
    b.moveTo(sub[0].x, sub[0].y);
    for (let i = 1; i < sub.length; i++) {
      const prev = sub[i - 1];
      const cur = sub[i];
      const hasHandle = prev.outHandle != null || cur.inHandle != null;
      if (!hasHandle) {
        b.lineTo(cur.x, cur.y);
      } else {
        const c1 = prev.outHandle ?? { x: prev.x, y: prev.y };
        const c2 = cur.inHandle ?? { x: cur.x, y: cur.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, cur.x, cur.y);
      }
    }
    if (closed[s]) {
      // Bridge last → first if they have curve handles; either way emit Z.
      const last = sub[sub.length - 1];
      const first = sub[0];
      const hasHandle = last.outHandle != null || first.inHandle != null;
      if (hasHandle) {
        const c1 = last.outHandle ?? { x: last.x, y: last.y };
        const c2 = first.inHandle ?? { x: first.x, y: first.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, first.x, first.y);
      }
      b.close();
    }
  }
  return b.build();
}

const SMOOTH_THRESHOLD = 0.001;

/**
 * Returns true if the anchor's in-handle and out-handle are collinear with
 * the anchor point, indicating "smooth" (mirror-drag) behavior. Detected via
 * the magnitude of the normalized cross product of the two handle vectors.
 *
 * Edge cases:
 *   - Missing in or out handle → false (corner by definition).
 *   - Either handle at zero distance from anchor → false.
 */
export function isAnchorSmooth(a: PenAnchor): boolean {
  if (!a.inHandle || !a.outHandle) return false;
  const inDX = a.inHandle.x - a.x;
  const inDY = a.inHandle.y - a.y;
  const outDX = a.outHandle.x - a.x;
  const outDY = a.outHandle.y - a.y;
  const inLen = Math.hypot(inDX, inDY);
  const outLen = Math.hypot(outDX, outDY);
  if (inLen === 0 || outLen === 0) return false;
  // For collinear handles on opposite sides of the anchor, the cross product
  // of the two handle vectors should be zero. Normalize by both magnitudes.
  const cross = (inDX * outDY - inDY * outDX) / (inLen * outLen);
  return Math.abs(cross) < SMOOTH_THRESHOLD;
}

/** How many anchors a path has. Matches the per-anchor arrays the renderer
 *  expects for `vertexColors`. */
export function countPathAnchors(path: Path): number {
  if (path.kind === 'rect') return 4;
  const cmds = path.commands;
  let n = 0;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c === PATH_M || c === PATH_L || c === PATH_C || c === PATH_Q) n++;
  }
  return n;
}

/** The segment `(sub, segIdx)` as its two end anchors, or null when it
 *  doesn't exist. `segIdx === sub.length - 1` names a closed subpath's
 *  closing segment, which runs from the last anchor back to the first. */
export function segmentEnds(
  anchors: readonly PenAnchor[][],
  closed: readonly boolean[] | undefined,
  sub: number,
  segIdx: number,
): { a: PenAnchor; b: PenAnchor } | null {
  const s = anchors[sub];
  if (!s || segIdx < 0) return null;
  if (segIdx + 1 < s.length) return { a: s[segIdx], b: s[segIdx + 1] };
  if (closed?.[sub] && s.length > 1 && segIdx === s.length - 1) return { a: s[segIdx], b: s[0] };
  return null;
}

/** Whether the segment from `a` to `b` is a straight line (no handles). */
export function isStraightSegment(a: PenAnchor, b: PenAnchor): boolean {
  return a.outHandle == null && b.inHandle == null;
}

/** Nearest parameter on one segment to `(x, y)`, with its squared distance.
 *  A straight segment is parameterized by arc length (`t` is the fraction of
 *  the way from `a` to `b`), matching how {@link insertAnchorOnSegment}
 *  splits one. */
function nearestOnSegment(a: PenAnchor, b: PenAnchor, x: number, y: number): { t: number; d2: number } {
  const p1 = a.outHandle ?? a;
  const p2 = b.inHandle ?? b;
  const hit = isStraightSegment(a, b)
    ? nearestOnLine(x, y, a.x, a.y, b.x, b.y)
    : nearestOnCubic(x, y, a.x, a.y, p1.x, p1.y, p2.x, p2.y, b.x, b.y);
  return { t: hit.t, d2: hit.dist * hit.dist };
}

/** The segment of a decoded path nearest `(wx, wy)`, and the parameter `t`
 *  on it closest to that point. Pass `closed` (from `pathToAnchors`) to
 *  include each closed subpath's closing segment, reported as
 *  `segIdx === sub.length - 1`. `t` spans `[0, 1]`, endpoints included.
 *  Returns `null` only when there are no segments. */
export function nearestSegmentT(
  anchors: PenAnchor[][],
  wx: number,
  wy: number,
  closed?: readonly boolean[],
): { sub: number; segIdx: number; t: number } | null {
  let bestD2 = Infinity;
  let best: { sub: number; segIdx: number; t: number } | null = null;
  for (let s = 0; s < anchors.length; s++) {
    const segCount = anchors[s].length - (closed?.[s] ? 0 : 1);
    for (let i = 0; i < segCount; i++) {
      const ends = segmentEnds(anchors, closed, s, i);
      if (!ends) continue;
      const hit = nearestOnSegment(ends.a, ends.b, wx, wy);
      if (hit.d2 < bestD2) {
        bestD2 = hit.d2;
        best = { sub: s, segIdx: i, t: hit.t };
      }
    }
  }
  return best;
}
