/** The pen tool's scratch: building, clearing and reading it. */
import { anchorsToPath, type PolygonPath } from '@weasel-js/geom';
import type { PenScratch, PenSubpath } from './usePenTool';

export function freshScratch(): PenScratch {
  return {
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
    continuing: null,
  };
}

export function resetScratch(s: PenScratch): void {
  s.finishedSubpaths = [];
  s.current = null;
  s.cursor = null;
  s.draggingHandleAt = null;
  s.closeHintActive = false;
  s.continuing = null;
  s.justClosed = false;
}

/** Total anchors across finished subpaths plus the in-progress one. */
export function anchorCount(s: PenScratch): number {
  return (s.current ? s.current.anchors.length : 0)
    + s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
}

/** Build a PolygonPath from the pen's accumulated subpaths, by the same
 *  rule as any anchor set: segment A→B is a cubic through A's out-handle and
 *  B's in-handle when either exists, else a line. */
export function buildPath(
  subpaths: PenSubpath[],
  trailing: PenSubpath | null,
): PolygonPath {
  const all = [...subpaths];
  if (trailing && trailing.anchors.length > 0) all.push(trailing);
  return anchorsToPath(all.map((sp) => sp.anchors), all.map((sp) => sp.closed));
}

/** A new subpath, marked when the press before it closed a path. Spends that mark. */
export function startSubpath(s: PenScratch): PenSubpath {
  const followsClose = s.justClosed === true;
  s.justClosed = false;
  return followsClose ? { anchors: [], closed: false, followsClose } : { anchors: [], closed: false };
}
