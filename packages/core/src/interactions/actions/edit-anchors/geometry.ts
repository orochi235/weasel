import { forEachSegment, originOf, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, worldCoords, type PolygonPath } from '@weasel-js/geom';

/** A single anchor on a `PolygonPath`, with its incoming/outgoing bezier
 *  control points (when present). `coordIndex` points at the anchor's own
 *  on-curve x in the `coords` array. `inCoordIndex` / `outCoordIndex` point
 *  at the corresponding control x. */
export interface PathAnchor {
  /** Sequential anchor index in walk order (0-based). */
  anchorIndex: number;
  /** On-curve point. */
  x: number;
  y: number;
  /** Incoming control (from the previous segment, when it was C/Q). */
  controlIn?: { x: number; y: number; coordIndex: number };
  /** Outgoing control (from the next segment, when it is C/Q). */
  controlOut?: { x: number; y: number; coordIndex: number };
  /** Index of the anchor's on-curve x in `coords`. */
  coordIndex: number;
  /** Set on the first anchor of a closed subpath whose last curve ends
   *  exactly on it: the index of that curve's end x, the same point again. */
  closeCoordIndex?: number;
}

/** Walk a PolygonPath's command stream and yield one `PathAnchor` per
 *  on-curve point. Adjacent C/Q control points are attached as
 *  `controlIn`/`controlOut`. Subpath boundaries (M after a previous M or Z)
 *  start fresh — the new M's anchor has no `controlIn` from a Z. A closing
 *  curve that ends exactly on the subpath's first point is not a second
 *  anchor: its control becomes the first anchor's `controlIn`, the way
 *  `pathToAnchors` reads it, so the two walkers count alike. */
export function enumerateAnchors(path: PolygonPath): PathAnchor[] {
  const { commands } = path;
  const coords = worldCoords(path);
  const anchors: PathAnchor[] = [];
  let lastAnchor: PathAnchor | null = null;
  let firstInSubpath: PathAnchor | null = null;

  const push = (coordIndex: number, controlIn?: PathAnchor['controlIn']): void => {
    const a: PathAnchor = {
      anchorIndex: anchors.length,
      x: coords[coordIndex],
      y: coords[coordIndex + 1],
      coordIndex,
      ...(controlIn ? { controlIn } : {}),
    };
    anchors.push(a);
    lastAnchor = a;
  };

  forEachSegment(commands, coords, (cmd, ci) => {
    switch (cmd) {
      case PATH_M:
        push(ci);
        firstInSubpath = lastAnchor;
        break;
      case PATH_L:
        push(ci);
        break;
      case PATH_C:
        if (lastAnchor) {
          lastAnchor.controlOut = { x: coords[ci], y: coords[ci + 1], coordIndex: ci };
        }
        push(ci + 4, { x: coords[ci + 2], y: coords[ci + 3], coordIndex: ci + 2 });
        break;
      case PATH_Q:
        if (lastAnchor) {
          lastAnchor.controlOut = { x: coords[ci], y: coords[ci + 1], coordIndex: ci };
        }
        push(ci + 2, { x: coords[ci], y: coords[ci + 1], coordIndex: ci });
        break;
      case PATH_Z:
        foldClosingCurve(anchors, firstInSubpath, lastAnchor);
        lastAnchor = null;
        firstInSubpath = null;
        break;
      default:
        throw new Error(`enumerateAnchors: unknown command ${cmd}`);
    }
  });
  return anchors;
}

function foldClosingCurve(anchors: PathAnchor[], first: PathAnchor | null, last: PathAnchor | null): void {
  if (!first || !last || first === last) return;
  if (!last.controlIn || last.x !== first.x || last.y !== first.y) return;
  anchors.pop();
  first.closeCoordIndex = last.coordIndex;
  first.controlIn = last.controlIn;
}

/** A new PolygonPath sharing `path`'s commands, with the point at `coordIndex`
 *  moved to `(x, y)` in the path's own space, in a fresh coords buffer. */
export function withCoord(path: PolygonPath, coordIndex: number, x: number, y: number): PolygonPath {
  const next = new Float32Array(path.coords);
  const o = originOf(path);
  next[coordIndex] = x - o.x;
  next[coordIndex + 1] = y - o.y;
  return { ...path, coords: next };
}

/** Translate anchor `anchorIndex` AND its attached control handles
 *  (`controlIn` / `controlOut`) by `(dx, dy)`. Used by `editAnchorsAction`
 *  when the dragged affordance is the anchor itself — moving the anchor
 *  without its handles would shear the surrounding bezier segments. */
export function translateAnchor(
  path: PolygonPath,
  anchorIndex: number,
  dx: number,
  dy: number,
): PolygonPath {
  const anchors = enumerateAnchors(path);
  const a = anchors[anchorIndex];
  if (!a) return path;
  const next = new Float32Array(path.coords);
  // Anchor itself.
  next[a.coordIndex] += dx;
  next[a.coordIndex + 1] += dy;
  if (a.closeCoordIndex !== undefined) {
    next[a.closeCoordIndex] += dx;
    next[a.closeCoordIndex + 1] += dy;
  }
  // In-handle of THIS anchor — the trailing pair of the incoming C/Q.
  if (a.controlIn) {
    next[a.controlIn.coordIndex] += dx;
    next[a.controlIn.coordIndex + 1] += dy;
  }
  // Out-handle: the leading pair of the OUTGOING C/Q. Owned by this
  // anchor's segment.
  if (a.controlOut) {
    next[a.controlOut.coordIndex] += dx;
    next[a.controlOut.coordIndex + 1] += dy;
  }
  return { ...path, coords: next };
}
