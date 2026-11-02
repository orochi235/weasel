/**
 * Putting corner specs back on a path an operation rebuilt from expanded
 * geometry. Booleans, trims and cuts work on what a path draws, its corners
 * cut and spanned (`resolveCorners`); wherever a corner's cut comes through
 * whole, it folds back into its anchor and spec, and only a corner the
 * operation cut into or moved stays expanded.
 */
import type { Path, PolygonPath } from '../path';
import { nearestOnCubic, nearestOnLine } from '../nearest';
import { PathBuilder } from './builder';
import { flatAnchorIndices } from './cornerCarry';
import { decodeContours, type Contour, type Seg } from './cornerSegments';
import type { Point } from './cubicMath';
import type { CornerPiece } from './cornerShape';
import { compactCorners, withoutCorners, type CornerSpec } from './cornerSpec';
import { cornerCuts } from './corners';
import { distance, lerpPoint } from '../points2';

/** A corner a rebuilt path may hold expanded: the anchor and spec it folds
 *  back into, and the cut it is drawn as, from `start` to `end`. */
export interface CornerTrace {
  anchor: Point;
  spec: CornerSpec;
  start: Point;
  end: Point;
  pieces: readonly CornerPiece[];
}

/** How far a point may sit from where a corner draws it and still count as on it. */
export const CORNER_RESTORE_TOLERANCE = 1e-3;

/** The corners `path` cuts, as {@link restoreCorners} looks for them. */
export function cornerTraces(path: Path): CornerTrace[] {
  if (path.kind !== 'polygon') return [];
  return cornerCuts(path).map(({ anchor, spec, start, end, pieces }) => ({ anchor, spec, start, end, pieces }));
}

/**
 * `result` with the corners of `sources` folded back in wherever it still
 * draws them whole: an operation's output, rebuilt from what the sources
 * draw. A corner the operation cut into, or whose edges it moved, stays as
 * the plain geometry it already is.
 */
export function keepCorners(sources: readonly Path[], result: PolygonPath, tolerance = CORNER_RESTORE_TOLERANCE): PolygonPath {
  const traces = sources.flatMap(cornerTraces);
  return traces.length === 0 ? result : restoreCorners(result, traces, tolerance);
}

function onTrace(p: Point, t: CornerTrace, tol: number): boolean {
  let from = t.start;
  for (const piece of t.pieces) {
    const d = piece.kind === 'line'
      ? nearestOnLine(p.x, p.y, from.x, from.y, piece.to.x, piece.to.y).dist
      : nearestOnCubic(p.x, p.y, from.x, from.y, piece.c1.x, piece.c1.y, piece.c2.x, piece.c2.y, piece.to.x, piece.to.y).dist;
    if (d <= tol) return true;
    from = piece.to;
  }
  return false;
}

/** The blossom of cubic `s` at `(u, v, w)`. */
function blossom(s: Seg, u: number, v: number, w: number): Point {
  const a = lerpPoint(s.p0, s.c1, u), b = lerpPoint(s.c1, s.c2, u), c = lerpPoint(s.c2, s.p3, u);
  const d = lerpPoint(a, b, v), e = lerpPoint(b, c, v);
  return lerpPoint(d, e, w);
}

/** The parameter, past `[0, 1]` on the side `from` gives, where cubic `s`
 *  carried on as the same polynomial passes through `target`; null if it does not. */
function extendTo(s: Seg, target: Point, from: 0 | 1, tol: number): number | null {
  const at = (u: number) => blossom(s, u, u, u);
  const d1 = (u: number): Point => {
    const a = blossom(s, u, u, 0), b = blossom(s, u, u, 1);
    return { x: 3 * (b.x - a.x), y: 3 * (b.y - a.y) };
  };
  const speed = Math.hypot(d1(from).x, d1(from).y);
  if (speed === 0) return null;
  let u = from + (from === 1 ? 1 : -1) * distance(at(from), target) / speed;
  for (let i = 0; i < 30; i++) {
    const p = at(u), d = d1(u);
    const dd = d.x * d.x + d.y * d.y;
    if (dd === 0) break;
    u -= ((p.x - target.x) * d.x + (p.y - target.y) * d.y) / dd;
  }
  return distance(at(u), target) <= tol ? u : null;
}

/** `s` with its start moved to `start` and its end to `end`, either left
 *  where it was when undefined; null when a curve cannot reach them. */
function reachSeg(s: Seg, start: Point | undefined, end: Point | undefined, tol: number): Seg | null {
  const p0 = start ?? s.p0, p3 = end ?? s.p3;
  if (s.line) return { line: true, p0, c1: p0, c2: p3, p3 };
  const u0 = start ? extendTo(s, start, 0, tol) : 0;
  const u1 = end ? extendTo(s, end, 1, tol) : 1;
  if (u0 === null || u1 === null) return null;
  return { line: false, p0, c1: blossom(s, u0, u0, u1), c2: blossom(s, u0, u1, u1), p3 };
}

/** A stretch of a contour's anchors, `from` to `to` going forward, that draws one corner. */
interface Run { from: number; to: number; trace: CornerTrace }

/** Whether anchor `a`, reached or left by straight edge `edge`, ends a corner's
 *  cut at `p`: it sits there, or it sits on the cut and the edge runs through
 *  `p` to it, as when flattening has merged the cut's end into the edge. */
function endsCut(a: Point, edge: Seg, p: Point, t: CornerTrace, tol: number): boolean {
  if (distance(a, p) <= tol) return true;
  return edge.line && onTrace(a, t, tol)
    && nearestOnLine(p.x, p.y, edge.p0.x, edge.p0.y, edge.p3.x, edge.p3.y).dist <= tol;
}

function findRun(c: Contour, t: CornerTrace, tol: number): Run | null {
  const n = c.anchors.length;
  for (let i = c.closed ? 0 : 1; i < n; i++) {
    for (const [first, last] of [[t.start, t.end], [t.end, t.start]] as const) {
      if (!endsCut(c.anchors[i], c.segs[(i - 1 + n) % n], first, t, tol)) continue;
      for (let j = i + 1, steps = 1; steps < c.segs.length; j++, steps++) {
        if (!c.closed && j >= n - 1) break;
        const a = c.anchors[j % n];
        const seg = c.segs[(j - 1) % n];
        if (!seg.line && !onTrace(blossom(seg, 0.5, 0.5, 0.5), t, tol)) break;
        if (endsCut(a, c.segs[j % n], last, t, tol)) return { from: i, to: j % n, trace: t };
        if (!onTrace(a, t, tol)) break;
      }
    }
  }
  return null;
}

/** The anchors a run covers, its ends included. */
function covered(run: Run, n: number): number[] {
  const out: number[] = [];
  for (let k = run.from; ; k = (k + 1) % n) {
    out.push(k);
    if (k === run.to) return out;
  }
}

interface Node { at: Point; spec: CornerSpec | null }
interface Rebuilt { nodes: Node[]; segs: Seg[]; closed: boolean; folded: Run[] }

/** `c` with each of `runs` folded into its anchor; null when an edge next to one cannot reach it. */
function foldContour(c: Contour, runs: readonly Run[], specs: readonly (CornerSpec | null)[], tol: number): Rebuilt | null {
  const n = c.anchors.length;
  const runAt = new Map<number, Run>();
  const inside = new Set<number>();
  for (const run of runs) {
    runAt.set(run.from, run);
    for (const k of covered(run, n)) inside.add(k);
  }
  let begin = 0;
  if (c.closed) {
    const free = c.anchors.findIndex((_a, k) => !inside.has(k));
    begin = free >= 0 ? free : runs[0]!.from;
  }
  const nodes: Node[] = [];
  const exits: number[] = []; // anchor each node's outgoing segment leaves from
  for (let step = 0, k = begin; step < n; ) {
    const run = runAt.get(k);
    if (run) {
      nodes.push({ at: run.trace.anchor, spec: run.trace.spec });
      exits.push(run.to);
      const span = covered(run, n).length;
      step += span;
      k = (run.to + 1) % n;
    } else {
      nodes.push({ at: c.anchors[k], spec: specs[k] ?? null });
      exits.push(k);
      step++;
      k = (k + 1) % n;
    }
  }
  const runEnds = new Set(runs.map((r) => r.to));
  const segs: Seg[] = [];
  const count = c.closed ? nodes.length : nodes.length - 1;
  for (let m = 0; m < count; m++) {
    const exit = exits[m]!;
    const moveStart = runEnds.has(exit) ? nodes[m]!.at : undefined;
    const moveEnd = runAt.has((exit + 1) % n) ? nodes[(m + 1) % nodes.length]!.at : undefined;
    const reached = reachSeg(c.segs[exit]!, moveStart, moveEnd, tol);
    if (!reached) return null;
    segs.push(reached);
  }
  return { nodes, segs, closed: c.closed, folded: [...runs] };
}

function write(contours: readonly Rebuilt[], result: PolygonPath): PolygonPath {
  const b = new PathBuilder();
  if (result.origin) b.setOrigin(result.origin.x, result.origin.y);
  const specs: (CornerSpec | null)[] = [];
  for (const { nodes, segs, closed } of contours) {
    b.moveTo(nodes[0]!.at.x, nodes[0]!.at.y);
    specs.push(nodes[0]!.spec);
    segs.forEach((s, m) => {
      const to = nodes[(m + 1) % nodes.length]!;
      const closing = closed && m === segs.length - 1;
      if (closing && s.line) return;
      if (s.line) b.lineTo(to.at.x, to.at.y);
      else b.curveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, to.at.x, to.at.y);
      specs.push(to.spec);
    });
    if (closed) b.close();
  }
  const { commands, coords } = b.build();
  const built: PolygonPath = { ...withoutCorners(result), commands, coords };
  const flat = flatAnchorIndices(built);
  const corners: (CornerSpec | null)[] = [];
  specs.forEach((spec, k) => {
    if (!spec) return;
    while (corners.length < flat[k]!) corners.push(null);
    corners[flat[k]!] = spec;
  });
  const compact = compactCorners(corners);
  return compact ? { ...built, corners: compact } : built;
}

/** Whether every corner folded into `path` draws again where its trace says. */
function failedTraces(path: PolygonPath, tol: number, folded: readonly Run[]): Set<CornerTrace> {
  const bad = new Set(folded.map((r) => r.trace));
  for (const cut of cornerCuts(path)) {
    for (const t of bad) {
      if (distance(cut.anchor, t.anchor) > tol) continue;
      const same = (distance(cut.start, t.start) <= tol && distance(cut.end, t.end) <= tol)
        || (distance(cut.start, t.end) <= tol && distance(cut.end, t.start) <= tol);
      if (same) bad.delete(t);
    }
  }
  return bad;
}

/**
 * `result` with each of `traces` it draws whole folded back into its anchor
 * and spec. A trace counts as drawn when a run of anchors goes from one end
 * of its cut to the other along it, the edges either side carry on to its
 * anchor, and the folded corner cuts the same again. Specs `result` already
 * holds are kept.
 */
export function restoreCorners(result: PolygonPath, traces: readonly CornerTrace[], tolerance = CORNER_RESTORE_TOLERANCE): PolygonPath {
  const contours = decodeContours(result);
  if (!contours || traces.length === 0) return result;
  const rejected = new Set<CornerTrace>();
  for (let attempt = 0; attempt <= traces.length; attempt++) {
    const rebuilt: Rebuilt[] = [];
    for (const c of contours) {
      const runs: Run[] = [];
      const used = new Set<number>();
      for (const t of traces) {
        if (rejected.has(t)) continue;
        const run = findRun(c, t, tolerance);
        if (!run) continue;
        const span = covered(run, c.anchors.length);
        if (span.some((k) => used.has(k))) continue;
        span.forEach((k) => used.add(k));
        runs.push(run);
      }
      const specs = c.anchors.map((_a, k) => result.corners?.[c.first + k] ?? null);
      const folded = runs.length > 0 ? foldContour(c, runs, specs, tolerance) : null;
      if (runs.length > 0 && !folded) {
        runs.forEach((r) => rejected.add(r.trace));
        rebuilt.length = 0;
        break;
      }
      rebuilt.push(folded ?? { nodes: c.anchors.map((at, k) => ({ at, spec: specs[k]! })), segs: c.segs, closed: c.closed, folded: [] });
    }
    if (rebuilt.length !== contours.length) continue;
    const folded = rebuilt.flatMap((r) => r.folded);
    if (folded.length === 0) return result;
    const out = write(rebuilt, result);
    const bad = failedTraces(out, tolerance, folded);
    if (bad.size === 0) return out;
    bad.forEach((t) => rejected.add(t));
  }
  return result;
}
