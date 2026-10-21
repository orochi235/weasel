import type { BadgeBase } from '@weasel-js/ui/components/Badge';
import { type BadgeOctantSplineBaseParams } from '@weasel-js/ui/components/Badge';
import { OCTANT_BSPLINE_MIN_WEIGHT, compileNurbs, evalNurbsAtS } from '../bases/OctantBSpline';
import { OCTANT_SPLINE_DEFAULTS, OCTANT_SPLINE_MAX_ANCHORS, compileSpline, evalCompiled, type Anchor } from '../bases/OctantSpline';
import type { LabParams } from './snapshot';

export type SplineAnchor = Anchor;
export type SplineMode = 'octant' | 'quadrant';
type SplineParams = LabParams;

const MIN_ANCHORS = 3;
/** The closest two anchors may sit along the curve when one is inserted between them. */
const INSERT_GAP = 0.01;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function slot(params: SplineParams, axis: 's' | 'r' | 'w', i: number): number {
  return Number(params[`${axis}${i}`] ?? OCTANT_SPLINE_DEFAULTS[`${axis}${i}` as keyof BadgeOctantSplineBaseParams]);
}

export function anchorCount(params: SplineParams): number {
  return clamp(Math.floor(Number(params.count ?? OCTANT_SPLINE_DEFAULTS.count)), MIN_ANCHORS, OCTANT_SPLINE_MAX_ANCHORS);
}

export function splineMode(params: SplineParams): SplineMode {
  return params.mode === 'quadrant' ? 'quadrant' : 'octant';
}

/** The active anchors in slot order, with the two ends pinned to s = 0 and s = 1. */
export function readAnchors(params: SplineParams): SplineAnchor[] {
  const count = anchorCount(params);
  return Array.from({ length: count }, (_, i) => ({
    s: i === 0 ? 0 : i === count - 1 ? 1 : clamp(slot(params, 's', i), 0, 1),
    r: Math.max(0, slot(params, 'r', i)),
    w: clamp(slot(params, 'w', i), 0, 3),
  }));
}

/** A new anchor count, with the active anchors spread evenly along the curve. */
export function withAnchorCount(params: SplineParams, newCount: number): SplineParams {
  const n = clamp(Math.floor(newCount), MIN_ANCHORS, OCTANT_SPLINE_MAX_ANCHORS);
  const next: SplineParams = { ...params, count: n };
  for (let i = 0; i < n; i++) next[`s${i}`] = i / (n - 1);
  return next;
}

/**
 * Anchor `idx` moved to `anchor`. In quadrant mode the two ends are the same
 * point under the 4-fold rotation, so an edit to either one's radius or weight
 * is mirrored to the other.
 */
export function withAnchor(params: SplineParams, idx: number, anchor: SplineAnchor): SplineParams {
  const next: SplineParams = { ...params, [`s${idx}`]: anchor.s, [`r${idx}`]: anchor.r, [`w${idx}`]: anchor.w };
  if (splineMode(params) !== 'quadrant') return next;
  const last = anchorCount(params) - 1;
  if (idx === 0) {
    next[`r${last}`] = anchor.r;
    next[`w${last}`] = anchor.w;
  } else if (idx === last) {
    next.r0 = anchor.r;
    next.w0 = anchor.w;
  }
  return next;
}

/** Interior anchor `idx` removed; `params` itself when it is an end or the curve is at its minimum. */
export function withoutAnchor(params: SplineParams, idx: number): SplineParams {
  const count = anchorCount(params);
  if (count <= MIN_ANCHORS || idx === 0 || idx === count - 1) return params;
  const next: SplineParams = { ...params };
  for (let i = idx; i < count - 1; i++) {
    next[`s${i}`] = slot(params, 's', i + 1);
    next[`r${i}`] = slot(params, 'r', i + 1);
    next[`w${i}`] = slot(params, 'w', i + 1);
  }
  next.count = count - 1;
  return next;
}

/** An anchor inserted at `s` with radius `r`; `params` itself when the curve is full or has no room there. */
export function withInsertedAnchor(params: SplineParams, s: number, r: number): SplineParams {
  const count = anchorCount(params);
  if (count >= OCTANT_SPLINE_MAX_ANCHORS) return params;
  const anchors = readAnchors(params);
  let at = 1;
  while (at < count && anchors[at].s < s) at++;
  if (at >= count) at = count - 1;
  const before = anchors[at - 1].s;
  const after = anchors[at].s;
  if (after - before < 2 * INSERT_GAP) return params;
  const next: SplineParams = { ...params };
  for (let i = count; i > at; i--) {
    next[`s${i}`] = slot(params, 's', i - 1);
    next[`r${i}`] = slot(params, 'r', i - 1);
    next[`w${i}`] = slot(params, 'w', i - 1);
  }
  next[`s${at}`] = Math.round(clamp(s, before + INSERT_GAP, after - INSERT_GAP) * 1000) / 1000;
  next[`r${at}`] = r;
  next[`w${at}`] = 1;
  next.count = count + 1;
  return next;
}

/** r(s) as the named base draws it through `anchors`. */
export function splineEvaluator(base: BadgeBase, anchors: SplineAnchor[]): (s: number) => number {
  if (base === 'octant-bspline') {
    const nurbs = compileNurbs(anchors.map((a) => ({ ...a, w: Math.max(OCTANT_BSPLINE_MIN_WEIGHT, a.w) })));
    return (s) => evalNurbsAtS(s, nurbs);
  }
  const spline = compileSpline(anchors);
  return (s) => evalCompiled(s, spline);
}
