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

import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath } from './types';
import { PathBuilder } from './builder';

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
  let ci = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        if (current) { anchors.push(current); closed.push(false); }
        current = [{ x: coords[ci], y: coords[ci + 1] }];
        ci += 2;
        break;
      }
      case PATH_L: {
        if (!current) throw new Error('pathToAnchors: L without prior M');
        current.push({ x: coords[ci], y: coords[ci + 1] });
        ci += 2;
        break;
      }
      case PATH_C: {
        if (!current) throw new Error('pathToAnchors: C without prior M');
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        const prev = current[current.length - 1];
        prev.outHandle = { x: x1, y: y1 };
        current.push({ x: x3, y: y3, inHandle: { x: x2, y: y2 } });
        ci += 6;
        break;
      }
      case PATH_Q: {
        if (!current) throw new Error('pathToAnchors: Q without prior M');
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        // Quadratic → cubic: handle is the same control point on both sides.
        const prev = current[current.length - 1];
        prev.outHandle = { x: x1, y: y1 };
        current.push({ x: x2, y: y2, inHandle: { x: x1, y: y1 } });
        ci += 4;
        break;
      }
      case PATH_Z: {
        if (current) { anchors.push(current); closed.push(true); current = null; }
        break;
      }
      default:
        throw new Error(`pathToAnchors: unknown command ${cmd}`);
    }
  }
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

/** Sample every segment in `anchors` (a decoded path) and return the
 *  closest (subpathIndex, segmentIndex, t) to the world point (wx, wy).
 *  Uses cubic-bezier de Casteljau sampling (segments without bezier
 *  handles are treated as straight lines via p1 = p0, p2 = p3). Returns
 *  `null` only when there are no segments to sample. Used by alt-click
 *  "insert anchor on path" gestures in the pen tool and the path-edit
 *  mode action; lives in `features/paths` so both share one implementation. */
export function nearestSegmentT(
  anchors: PenAnchor[][],
  wx: number,
  wy: number,
): { sub: number; segIdx: number; t: number } | null {
  const SAMPLES = 32;
  let bestD2 = Infinity;
  let best: { sub: number; segIdx: number; t: number } | null = null;
  for (let s = 0; s < anchors.length; s++) {
    const sub = anchors[s];
    for (let i = 0; i + 1 < sub.length; i++) {
      const a = sub[i];
      const b = sub[i + 1];
      const p0 = a;
      const p1 = a.outHandle ?? a;
      const p2 = b.inHandle ?? b;
      const p3 = b;
      for (let k = 1; k < SAMPLES; k++) {
        const t = k / SAMPLES;
        const u = 1 - t;
        const px = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
        const py = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
        const dx = px - wx;
        const dy = py - wy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = { sub: s, segIdx: i, t };
        }
      }
    }
  }
  return best;
}
