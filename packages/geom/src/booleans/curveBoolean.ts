/**
 * Booleans that keep curves: the operands' outlines are cut where they
 * cross, every piece is kept or dropped by the winding on its two sides, and
 * the kept pieces are joined back into loops. Each curve in the result is a
 * piece of an input curve, cut by de Casteljau subdivision.
 */

import type { Path, PolygonPath } from '../path';
import { PATH_C, PATH_Q } from '../commands';
import { resolveCorners } from '../paths/corners';
import { type Contour, type Seg, reverseContour, signedArea } from './contourSegments';
import { parseContours, extentOf } from './contours';
import { writePath } from './cutRegions';
import { cutEdges } from './curveEdges';
import { classifyEdges, windingSet } from './curveClassify';
import { traceLoops } from './curveTrace';

/** Inputs with more segments than this go to the polygon clipper, whose sweep scales better. */
const MAX_SEGMENTS = 4096;

function hasCurve(path: Path): boolean {
  const p = resolveCorners(path);
  return p.kind === 'polygon' && p.commands.some((c) => c === PATH_C || c === PATH_Q);
}

/** Drop a loop's closing line where it ends at the loop's start, so `Z` draws it. */
function closingTrimmed(loop: Seg[]): Seg[] {
  if (loop.length < 2) return loop;
  const last = loop[loop.length - 1];
  return last.length === 2 ? loop.slice(0, -1) : loop;
}

/**
 * The region of the plane where `keep` holds, given whether each of `paths`
 * covers a point, as a nonzero path whose curves are pieces of the inputs'.
 *
 * Null where the polygon clipper should answer instead: when no input has a
 * curve, when the inputs are very large, and in the cases this cannot
 * represent — outlines that coincide or overlap along a stretch (shared
 * edges, coincident curves), a cubic that crosses itself, or a vertex where
 * two outlines leave in the same direction and stay together, as at some
 * tangencies.
 */
export function curveBoolean(paths: readonly Path[], keep: (inside: boolean[]) => boolean): PolygonPath | null {
  if (!paths.some(hasCurve)) return null;
  const operands = paths.map((p) => parseContours(p));
  const count = operands.reduce((n, cs) => n + cs.reduce((m, c) => m + c.length, 0), 0);
  if (count === 0 || count > MAX_SEGMENTS) return null;

  const extent = extentOf(operands.flat()) || 1;
  const arrangement = cutEdges(operands, extent * 1e-6);
  if (!arrangement) return null;
  const sets = operands.map((cs, i) => {
    const p = paths[i];
    return windingSet(cs, p.kind === 'polygon' ? p.fillRule : 'nonzero');
  });
  const kept = classifyEdges(arrangement.edges, sets, keep, extent * 1e-7);
  if (!kept) return null;
  let loops: Contour[] | null = traceLoops(kept, arrangement.points.length);
  if (!loops) return null;

  // Keep the first operand's turning direction, so a curve that comes through whole comes back as it went in.
  if (clockwiseFirst(operands[0])) loops = loops.map(reversedFromFirst);
  return writePath(loops.map((l) => ({ segs: closingTrimmed(l), closed: true })), 'nonzero');
}

/** Whether the first operand's largest contour turns with its fill on the right. */
function clockwiseFirst(contours: readonly Contour[]): boolean {
  let best = 0;
  for (const c of contours) {
    const a = signedArea(c);
    if (Math.abs(a) > Math.abs(best)) best = a;
  }
  return best < 0;
}

/** `loop` reversed, starting at the segment that reverses its first. */
function reversedFromFirst(loop: Contour): Contour {
  const rev = reverseContour(loop);
  return [rev[rev.length - 1], ...rev.slice(0, -1)];
}
