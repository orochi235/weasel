import type { Bounds } from '@weasel-js/core';
import type { SpacingGap } from '../types';
import type { SpacingEdge, SpacingMatchResult } from './types';

const EPS = 1e-6;
type Axis = 'x' | 'y';

const lo = (b: Bounds, a: Axis): number => (a === 'x' ? b.x : b.y);
const hi = (b: Bounds, a: Axis): number => (a === 'x' ? b.x + b.width : b.y + b.height);
const cross = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');

/** The shared range of two boxes on `axis`, or null when they share none. */
function overlap(a: Bounds, b: Bounds, axis: Axis): [number, number] | null {
  const min = Math.max(lo(a, axis), lo(b, axis));
  const max = Math.min(hi(a, axis), hi(b, axis));
  return max - min > EPS ? [min, max] : null;
}

function gapBetween(a: Bounds, b: Bounds, axis: Axis): SpacingGap | null {
  const shared = overlap(a, b, cross(axis));
  if (shared === null) return null;
  return { axis, min: hi(a, axis), max: lo(b, axis), at: (shared[0] + shared[1]) / 2 };
}

/** Whether `b` covers any of the strip a gap marks out. */
function hitsStrip(g: SpacingGap, b: Bounds, span: [number, number]): boolean {
  const c = cross(g.axis);
  return lo(b, g.axis) < g.max - EPS && hi(b, g.axis) > g.min + EPS
    && lo(b, c) < span[1] - EPS && hi(b, c) > span[0] + EPS;
}

/**
 * The visible gaps between neighboring boxes along `axis`: for `'x'`, each box
 * and the nearest box to its right that shares some of its vertical range, as
 * long as no third box stands in the strip between them. These are the gaps an
 * equal-spacing snap can reproduce.
 */
export function measureGaps(targets: readonly Bounds[], axis: 'x' | 'y'): SpacingGap[] {
  return measureGapSpans(targets, axis).map((m) => m.gap);
}

/** A measured gap, and the stretch of the other axis its two boxes share. */
export interface MeasuredGap { gap: SpacingGap; span: [number, number] }

/** `measureGaps`, keeping each gap's shared span: what `referenceGaps`
 *  filters. Quadratic in `targets`, so a caller matching every frame keeps
 *  the result while the targets stand still. */
export function measureGapSpans(targets: readonly Bounds[], axis: Axis): MeasuredGap[] {
  const out: MeasuredGap[] = [];
  for (const a of targets) {
    let next: Bounds | null = null;
    for (const c of targets) {
      if (c === a || lo(c, axis) < hi(a, axis) + EPS) continue;
      if (overlap(a, c, cross(axis)) === null) continue;
      if (next === null || lo(c, axis) < lo(next, axis)) next = c;
    }
    if (next === null) continue;
    const gap = gapBetween(a, next, axis)!;
    const span = overlap(a, next, cross(axis))!;
    if (targets.some((t) => t !== a && t !== next && hitsStrip(gap, t, span))) continue;
    out.push({ gap, span });
  }
  return out.sort((p, q) => p.gap.min - q.gap.min || p.gap.at - q.gap.at);
}

/** A placement on one axis: the move that gives an equal gap of `size`. */
export interface SpacingOffer { delta: number; size: number }

/** Every equal-spacing placement on one axis, unfiltered by reach: each
 *  reference gap reproduced beside a neighbor, and centering between the two
 *  neighbors. */
export function spacingOffers(
  b: Bounds,
  axis: Axis,
  edge: SpacingEdge,
  targets: readonly Bounds[],
  refs: readonly SpacingGap[],
): SpacingOffer[] {
  const bLo = lo(b, axis);
  const bHi = hi(b, axis);
  const size = bHi - bLo;
  const center = (bLo + bHi) / 2;
  let left: Bounds | null = null;
  let right: Bounds | null = null;
  for (const t of targets) {
    if (overlap(t, b, cross(axis)) === null) continue;
    if (hi(t, axis) <= center && (left === null || hi(t, axis) > hi(left, axis))) left = t;
    if (lo(t, axis) >= center && (right === null || lo(t, axis) < lo(right, axis))) right = t;
  }
  const sizes = refs.map((g) => g.max - g.min);

  const out: SpacingOffer[] = [];
  const offer = (delta: number, gap: number): void => {
    if (gap > EPS) out.push({ delta, size: gap });
  };

  const L = left === null ? null : hi(left, axis);
  const R = right === null ? null : lo(right, axis);
  if (edge === 'both') {
    for (const g of sizes) {
      if (L !== null && (R === null || L + g + size <= R + EPS)) offer(L + g - bLo, g);
      if (R !== null && (L === null || R - g - size >= L - EPS)) offer(R - g - size - bLo, g);
    }
    if (L !== null && R !== null) {
      const g = (R - L - size) / 2;
      offer(L + g - bLo, g);
    }
  } else if (edge === 'max' && R !== null) {
    const own = L !== null ? [bLo - L] : [];
    for (const g of [...sizes, ...own]) if (R - g > bLo + EPS) offer(R - g - bHi, g);
  } else if (edge === 'min' && L !== null) {
    const own = R !== null ? [R - bHi] : [];
    for (const g of [...sizes, ...own]) if (L + g < bHi - EPS) offer(L + g - bLo, g);
  }
  return out;
}

/** The nearest equal-spacing placement on one axis within `tol`, or null. */
function bestAxis(
  b: Bounds,
  axis: Axis,
  edge: SpacingEdge,
  targets: readonly Bounds[],
  refs: readonly SpacingGap[],
  tol: number,
): SpacingOffer | null {
  let best: SpacingOffer | null = null;
  for (const o of spacingOffers(b, axis, edge, targets, refs)) {
    if (Math.abs(o.delta) > tol) continue;
    if (best === null || Math.abs(o.delta) < Math.abs(best.delta)) best = o;
  }
  return best;
}

/** Every gap of `size` on `axis` once the box sits at `b`: the matching
 *  reference gaps, plus the box's own gaps to its two neighbors. */
export function equalGaps(
  b: Bounds,
  axis: Axis,
  size: number,
  targets: readonly Bounds[],
  refs: readonly SpacingGap[],
): SpacingGap[] {
  const eq = (g: SpacingGap) => Math.abs(g.max - g.min - size) < 1e-3;
  const out = refs.filter(eq);
  // Only a box overlapping the gap-wide margins beside b can bound or block
  // one of b's own gaps, so the quadratic measure runs on those alone.
  const near = targets.filter((t) => hi(t, axis) > lo(b, axis) - size - EPS && lo(t, axis) < hi(b, axis) + size + EPS);
  const own = measureGaps([...near, b], axis).filter((g) =>
    (Math.abs(g.max - lo(b, axis)) < EPS || Math.abs(g.min - hi(b, axis)) < EPS) && eq(g));
  return [...out, ...own];
}

/** The measured gaps a box at `bounds` can reproduce: all but those it
 *  stands inside. */
export function referenceGaps(bounds: Bounds, measured: readonly MeasuredGap[]): SpacingGap[] {
  return measured.filter((m) => !hitsStrip(m.gap, bounds, m.span)).map((m) => m.gap);
}

/**
 * Match a box against the gaps between `targets`, Figma's "equal spacing":
 * on each axis, find where the box's gap to a neighbor equals a gap that
 * already exists between two other boxes, or where it sits centered between
 * its two neighbors. `moving` says which edges move on each axis — `'both'`
 * for a translate, `'min'`/`'max'` for a resize dragging that edge, `null` to
 * leave the axis alone. Default `'both'` on each axis.
 *
 * Targets should exclude the box itself. A reference gap the box now stands
 * inside no longer counts. The returned gaps are every gap equal to the one
 * snapped to, with the box at its snapped position — ready to draw with
 * `createGuidesLayer`'s `getGaps`.
 */
export function matchSpacing(
  bounds: Bounds,
  targets: readonly Bounds[],
  worldTolerance: { x: number; y: number },
  moving: { x: SpacingEdge | null; y: SpacingEdge | null } = { x: 'both', y: 'both' },
): SpacingMatchResult {
  const refsX = referenceGaps(bounds, measureGapSpans(targets, 'x'));
  const refsY = referenceGaps(bounds, measureGapSpans(targets, 'y'));
  const x = moving.x === null ? null : bestAxis(bounds, 'x', moving.x, targets, refsX, worldTolerance.x);
  const y = moving.y === null ? null : bestAxis(bounds, 'y', moving.y, targets, refsY, worldTolerance.y);
  const dx = x?.delta ?? 0;
  const dy = y?.delta ?? 0;
  const final = applyEdges(bounds, dx, dy, moving);
  return {
    dx,
    dy,
    gapsX: x === null ? [] : equalGaps(final, 'x', x.size, targets, refsX),
    gapsY: y === null ? [] : equalGaps(final, 'y', y.size, targets, refsY),
  };
}

/** Move the box's moving edges by the snap deltas. */
export function applyEdges(
  b: Bounds,
  dx: number,
  dy: number,
  moving: { x: SpacingEdge | null; y: SpacingEdge | null },
): Bounds {
  let { x, y, width, height } = b;
  if (moving.x === 'both') x += dx;
  else if (moving.x === 'min') { x += dx; width -= dx; }
  else if (moving.x === 'max') width += dx;
  if (moving.y === 'both') y += dy;
  else if (moving.y === 'min') { y += dy; height -= dy; }
  else if (moving.y === 'max') height += dy;
  return { x, y, width, height };
}
