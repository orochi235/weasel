import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type PolygonPath,
} from 'features/paths/types';

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
}

/** Walk a PolygonPath's command stream and yield one `PathAnchor` per
 *  on-curve point. Adjacent C/Q control points are attached as
 *  `controlIn`/`controlOut`. Subpath boundaries (M after a previous M or Z)
 *  start fresh — the new M's anchor has no `controlIn` from a Z. */
export function enumerateAnchors(path: PolygonPath): PathAnchor[] {
  const { commands, coords } = path;
  const anchors: PathAnchor[] = [];
  let ci = 0;
  let lastAnchor: PathAnchor | null = null;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        const a: PathAnchor = {
          anchorIndex: anchors.length,
          x: coords[ci],
          y: coords[ci + 1],
          coordIndex: ci,
        };
        anchors.push(a);
        lastAnchor = a;
        ci += 2;
        break;
      }
      case PATH_L: {
        const a: PathAnchor = {
          anchorIndex: anchors.length,
          x: coords[ci],
          y: coords[ci + 1],
          coordIndex: ci,
        };
        anchors.push(a);
        lastAnchor = a;
        ci += 2;
        break;
      }
      case PATH_C: {
        if (lastAnchor) {
          lastAnchor.controlOut = { x: coords[ci], y: coords[ci + 1], coordIndex: ci };
        }
        const a: PathAnchor = {
          anchorIndex: anchors.length,
          x: coords[ci + 4],
          y: coords[ci + 5],
          coordIndex: ci + 4,
          controlIn: { x: coords[ci + 2], y: coords[ci + 3], coordIndex: ci + 2 },
        };
        anchors.push(a);
        lastAnchor = a;
        ci += 6;
        break;
      }
      case PATH_Q: {
        if (lastAnchor) {
          lastAnchor.controlOut = { x: coords[ci], y: coords[ci + 1], coordIndex: ci };
        }
        const a: PathAnchor = {
          anchorIndex: anchors.length,
          x: coords[ci + 2],
          y: coords[ci + 3],
          coordIndex: ci + 2,
          controlIn: { x: coords[ci], y: coords[ci + 1], coordIndex: ci },
        };
        anchors.push(a);
        lastAnchor = a;
        ci += 4;
        break;
      }
      case PATH_Z: {
        lastAnchor = null;
        break;
      }
    }
  }
  return anchors;
}

/** Mutate `coords` in-place: write `(x, y)` at `coordIndex`, return a new
 *  PolygonPath sharing the same commands but with a fresh coords buffer. */
export function withCoord(path: PolygonPath, coordIndex: number, x: number, y: number): PolygonPath {
  const next = new Float32Array(path.coords);
  next[coordIndex] = x;
  next[coordIndex + 1] = y;
  return { kind: 'polygon', commands: path.commands, coords: next, fillRule: path.fillRule };
}
