/**
 * Resample: a path's anchors spread evenly along it by arc length, and its
 * curves refitted through them.
 */
import type { PolygonPath } from '../path';
import { nearestOnCubic, nearestOnLine } from '../nearest';
import { anchorsToPath, isAnchorSmooth, pathToAnchors, type PenAnchor } from './anchors';
import { keepCorner } from './fitRun';
import { arcRun, type ArcRun } from './arcRun';
import type { Point } from './cubicMath';
import { fitCubicWithTangents } from './schneiderFit';

/** Options for {@link resamplePath}. */
export interface ResamplePathOptions {
  /** How many anchors the result holds across all its subpaths. Default: as
   *  many as `path` has. Ignored when `spacing` is given. */
  count?: number;
  /** The distance along the path between neighboring anchors, in path units.
   *  Each run between fixed anchors is cut into the whole number of equal
   *  pieces nearest this. */
  spacing?: number;
  /** Keep every corner anchor (`isAnchorSmooth` false) where it is, with its
   *  corner, and resample the runs between. Default `true`. Open ends are
   *  kept either way. */
  keepCorners?: boolean;
  /** How far the result may stray from the original, in path units. A piece
   *  that cannot follow the original this closely is halved, so the result can
   *  hold more anchors than `count` asks for. Default 0.5. */
  tolerance?: number;
}

const FIT_SAMPLES = 16;
const MAX_HALVINGS = 6;

/** A run between two fixed anchors, as the arc-length measure over it. */
interface Span {
  run: ArcRun;
  pieces: number;
}

/**
 * `path` with its anchors spread evenly along each run between fixed anchors
 * ({@link ResamplePathOptions}), each new anchor heading the way the original
 * does there. Anchors that were smooth stay smooth, and the curves between
 * are fitted to the original. A closed subpath with no fixed anchor keeps
 * its first one as the place the even spacing starts from. Fill rules carry
 * over.
 */
export function resamplePath(path: PolygonPath, opts: ResamplePathOptions = {}): PolygonPath {
  const { anchors, closed } = pathToAnchors(path);
  const keepCorners = opts.keepCorners ?? true;
  const tol = Math.max(opts.tolerance ?? 0.5, 1e-6);
  const fixedBySub = anchors.map((sub, s) => fixedAnchors(sub, closed[s], keepCorners));
  const spansBySub = anchors.map((sub, s) => spansOf(sub, closed[s], fixedBySub[s]));
  allocate(spansBySub.flat(), fixedBySub, opts, anchors);

  const out: PenAnchor[][] = [];
  anchors.forEach((sub, s) => {
    if (sub.length < 2) {
      out.push(sub);
      return;
    }
    const fixed = fixedBySub[s];
    const first = sub[fixed[0]];
    const result: PenAnchor[] = [{ x: first.x, y: first.y }];
    keepCorner(result[0], first);
    spansBySub[s].forEach((span, k) => {
      const closing = closed[s] && k === spansBySub[s].length - 1;
      appendSpan(span, tol, result, closing);
      if (!closing) keepCorner(result[result.length - 1], sub[fixed[k + 1]]);
    });
    out.push(result);
  });
  return anchorsToPath(out, closed, path);
}

/** Indices of the anchors of `sub` that stay where they are, ascending. */
function fixedAnchors(sub: readonly PenAnchor[], closed: boolean, keepCorners: boolean): number[] {
  const n = sub.length;
  const fixed = new Set<number>();
  if (!closed && n > 0) {
    fixed.add(0);
    fixed.add(n - 1);
  }
  if (keepCorners) sub.forEach((a, i) => { if (!isAnchorSmooth(a)) fixed.add(i); });
  if (fixed.size === 0 && n > 0) fixed.add(0);
  return [...fixed].sort((a, b) => a - b);
}

function spansOf(sub: readonly PenAnchor[], closed: boolean, fixed: number[]): Span[] {
  if (sub.length < 2) return [];
  const stops = closed ? [...fixed, fixed[0] + sub.length] : fixed;
  const spans: Span[] = [];
  for (let k = 0; k + 1 < stops.length; k++) spans.push({ run: arcRun(sub, stops[k], stops[k + 1]), pieces: 1 });
  return spans;
}

/** How many equal pieces each span is cut into. */
function allocate(spans: Span[], fixedBySub: number[][], opts: ResamplePathOptions, anchors: PenAnchor[][]): void {
  if (opts.spacing !== undefined && opts.spacing > 0) {
    for (const span of spans) span.pieces = Math.max(1, Math.round(span.run.length / opts.spacing));
    return;
  }
  const count = Math.floor(opts.count ?? anchors.reduce((n, sub) => n + sub.length, 0));
  const fixedCount = fixedBySub.reduce((n, f, s) => n + (anchors[s].length < 2 ? anchors[s].length : f.length), 0);
  const free = count - fixedCount;
  const total = spans.reduce((n, span) => n + span.run.length, 0);
  if (free <= 0 || total === 0) return;
  // Largest remainder: whole shares first, then the leftover anchors to the
  // spans that lost the most to rounding down.
  const shares = spans.map((span) => (free * span.run.length) / total);
  spans.forEach((span, i) => { span.pieces = 1 + Math.floor(shares[i]); });
  let left = free - spans.reduce((n, span) => n + span.pieces - 1, 0);
  const order = shares.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0 && k < order.length; k++, left--) spans[order[k].i].pieces++;
}

/** Cut `span` into its pieces, fit each, and append the anchors after the
 *  first to `out`. `closing` folds the final anchor into `out[0]`. */
function appendSpan(span: Span, tol: number, out: PenAnchor[], closing: boolean): void {
  const pieces: Array<{ c1?: Point; c2?: Point; end: Point }> = [];
  const { run } = span;
  for (let j = 0; j < span.pieces; j++) {
    fitPiece(run, (run.length * j) / span.pieces, (run.length * (j + 1)) / span.pieces, tol, 0, pieces);
  }
  pieces.forEach((piece, i) => {
    const prev = out[out.length - 1];
    if (piece.c1) prev.outHandle = piece.c1;
    if (closing && i === pieces.length - 1) {
      if (piece.c2) out[0].inHandle = piece.c2;
      return;
    }
    out.push(piece.c2 ? { x: piece.end.x, y: piece.end.y, inHandle: piece.c2 } : { x: piece.end.x, y: piece.end.y });
  });
}

/** Fit the stretch `[s0, s1]` of `run`, halving it while one cubic strays
 *  past `tol`. */
function fitPiece(
  run: ArcRun, s0: number, s1: number, tol: number, depth: number,
  out: Array<{ c1?: Point; c2?: Point; end: Point }>,
): void {
  const samples: Point[] = [];
  const params: number[] = [];
  for (let i = 0; i <= FIT_SAMPLES; i++) {
    params.push(i / FIT_SAMPLES);
    samples.push(run.pointAt(s0 + ((s1 - s0) * i) / FIT_SAMPLES));
  }
  const a = samples[0];
  const e = samples[FIT_SAMPLES];
  if (worst(samples, (p) => nearestOnLine(p.x, p.y, a.x, a.y, e.x, e.y).dist) <= tol) {
    out.push({ end: e });
    return;
  }
  const tStart = run.headingAt(s0);
  const into = run.headingAt(s1, true);
  const { cp1, cp2 } = fitCubicWithTangents(samples, tStart, { x: -into.x, y: -into.y }, { params, passes: 3 });
  const err = worst(samples, (p) => nearestOnCubic(p.x, p.y, a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, e.x, e.y).dist);
  if (err > tol && depth < MAX_HALVINGS) {
    const mid = (s0 + s1) / 2;
    fitPiece(run, s0, mid, tol, depth + 1, out);
    fitPiece(run, mid, s1, tol, depth + 1, out);
    return;
  }
  out.push({ c1: cp1, c2: cp2, end: e });
}

function worst(samples: readonly Point[], dist: (p: Point) => number): number {
  let max = 0;
  for (let i = 1; i < samples.length - 1; i++) max = Math.max(max, dist(samples[i]));
  return max;
}

