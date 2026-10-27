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
import { type Edge, cutEdges } from './curveEdges';
import { type CoveredEdge, coverEdges, reversed, windingSet } from './curveClassify';
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

/** The operands' outlines cut at every crossing, each piece knowing which operands cover its two sides. */
export interface CurveCut {
  edges: CoveredEdge[];
  vertexCount: number;
  /** Per operand, whether its largest contour turns with its fill on the right. */
  clockwise: boolean[];
}

/**
 * `paths` cut against each other, curves kept. Null where the polygon
 * clipper should answer instead: when no input has a curve, when the inputs
 * are very large, and in the cases this cannot represent — outlines that
 * coincide or overlap along a stretch (shared edges, coincident curves), or a
 * cubic that crosses itself.
 */
export function cutPaths(paths: readonly Path[]): CurveCut | null {
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
  const edges = coverEdges(arrangement.edges, sets, extent * 1e-7);
  if (!edges) return null;
  return { edges, vertexCount: arrangement.points.length, clockwise: operands.map(clockwiseFirst) };
}

/**
 * The plane split by `label`, given whether each operand covers a point: for
 * every label other than -1 that holds somewhere, the closed loops bounding
 * where it holds, each with its region on the left. Null when a boundary does
 * not close into loops, as at a vertex where two outlines leave in the same
 * direction and stay together.
 */
export function curveRegions(cut: CurveCut, label: (inside: boolean[]) => number): Map<number, Contour[]> | null {
  const sides = new Map<number, Edge[]>();
  const add = (k: number, e: Edge) => {
    const list = sides.get(k);
    if (list) list.push(e); else sides.set(k, [e]);
  };
  for (const { edge, inL, inR } of cut.edges) {
    const l = label(inL), r = label(inR);
    if (l === r) continue;
    if (l !== -1) add(l, edge);
    if (r !== -1) add(r, reversed(edge));
  }
  const out = new Map<number, Contour[]>();
  for (const [k, edges] of sides) {
    const loops = traceLoops(edges, cut.vertexCount);
    if (!loops) return null;
    out.set(k, loops);
  }
  return out;
}

/** `loops` as a nonzero path, turned clockwise when `clockwise`, closing lines left to `Z`. */
export function writeLoops(loops: readonly Contour[], clockwise: boolean): PolygonPath {
  const turned = clockwise ? loops.map(reversedFromFirst) : loops;
  return writePath(turned.map((l) => ({ segs: closingTrimmed(l), closed: true })), 'nonzero');
}

/**
 * The region of the plane where `keep` holds, given whether each of `paths`
 * covers a point, as a nonzero path whose curves are pieces of the inputs'.
 * Null where {@link cutPaths} or {@link curveRegions} is.
 */
export function curveBoolean(paths: readonly Path[], keep: (inside: boolean[]) => boolean): PolygonPath | null {
  const cut = cutPaths(paths);
  if (!cut) return null;
  const regions = curveRegions(cut, (inside) => (keep(inside) ? 0 : -1));
  if (!regions) return null;
  // Keep the first operand's turning direction, so a curve that comes through whole comes back as it went in.
  return writeLoops(regions.get(0) ?? [], cut.clockwise[0]);
}

/** Whether a contour set's largest contour turns with its fill on the right. */
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
