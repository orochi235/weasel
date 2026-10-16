/** Writing segment lists back out as a path, the inverse of `pathSegments`. */

import type { Path, PolygonPath } from '../path';
import type { Seg } from '../booleans/contourSegments';
import { writePath } from '../booleans/cutRegions';

/** A run of segments, open or closed. */
export interface SegmentRun {
  segs: Seg[];
  closed: boolean;
}

/**
 * `runs` as a polygon path carrying `like`'s fill rule and open-fill setting.
 * A closed run's closing line is left to its `Z`, as a path reads it in, so
 * a run that went through `pathSegments` comes back with the same anchors.
 */
export function writeSubpaths(runs: readonly SegmentRun[], like: Path): PolygonPath {
  const trimmed = runs.filter((r) => r.segs.length > 0).map((r) => {
    if (!r.closed || r.segs.length < 2) return r;
    const last = r.segs[r.segs.length - 1];
    const start = r.segs[0][0];
    const end = last[last.length - 1];
    const closesItself = last.length === 2 && end.x === start.x && end.y === start.y;
    return closesItself ? { segs: r.segs.slice(0, -1), closed: true } : r;
  });
  const out = writePath(trimmed, like.kind === 'polygon' ? like.fillRule : 'nonzero');
  return like.kind === 'polygon' && like.openFill !== undefined ? { ...out, openFill: like.openFill } : out;
}
