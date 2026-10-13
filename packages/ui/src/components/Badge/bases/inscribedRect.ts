import type { ShapeInsets } from '../types';
import type { BaseSampler } from './types';

/** A rectangle in viewBox coordinates (0..100). */
export interface ViewRect { left: number; top: number; right: number; bottom: number }

const CENTER = 50;
/** viewBox units between outline samples: an edge cannot cross a corner of the rectangle unseen. */
const STEP = 0.5;

/** `sampler`'s outline as points, for a sampler built in a 100 by 100 box. */
export function outlinePoints(sampler: BaseSampler): [number, number][] {
  const count = Math.ceil(sampler.totalCss / STEP);
  return Array.from({ length: count }, (_, i) => {
    const p = sampler.perimeterAt((i / count) * sampler.totalCss);
    return [p.x, p.y] as [number, number];
  });
}

/**
 * The largest axis-aligned rectangle around the viewBox's center that holds none of `points`,
 * clipped to the viewBox. With the points an outline whose inside holds the center, that is
 * the largest such rectangle inside the outline.
 */
export function inscribedRect(points: readonly (readonly [number, number])[]): ViewRect {
  // Nearest the center first: a top or bottom edge moving outward takes points in one by one.
  const above = points.filter((p) => p[1] < CENTER).sort((a, b) => b[1] - a[1]);
  const below = points.filter((p) => p[1] > CENTER).sort((a, b) => a[1] - b[1]);
  const narrow = (span: [number, number], x: number) => {
    if (x <= CENTER) span[0] = Math.max(span[0], x);
    if (x >= CENTER) span[1] = Math.min(span[1], x);
  };
  const level: [number, number] = [0, 100];
  for (const p of points) if (p[1] === CENTER) narrow(level, p[0]);

  let best: ViewRect = { left: CENTER, top: CENTER, right: CENTER, bottom: CENTER };
  let bestArea = 0;
  const upper: [number, number] = [level[0], level[1]];
  for (let i = 0; i <= above.length; i++) {
    const top = i < above.length ? above[i][1] : 0;
    const span: [number, number] = [upper[0], upper[1]];
    for (let j = 0; j <= below.length; j++) {
      const bottom = j < below.length ? below[j][1] : 100;
      const area = (span[1] - span[0]) * (bottom - top);
      if (area > bestArea) {
        bestArea = area;
        best = { left: span[0], top, right: span[1], bottom };
      }
      if (j < below.length) narrow(span, below[j][0]);
    }
    if (i < above.length) narrow(upper, above[i][0]);
  }
  return best;
}

/**
 * The rectangle of its box that `sampler`'s outline leaves clear for content, for a sampler
 * built in a 100 by 100 box. Drawn in by half a sample step, which is as far as a corner of
 * the outline can reach between two samples.
 */
export function clearRect(sampler: BaseSampler): ViewRect {
  const r = inscribedRect(outlinePoints(sampler));
  const by = STEP / 2;
  return { left: r.left + by, top: r.top + by, right: Math.max(r.left + by, r.right - by), bottom: Math.max(r.top + by, r.bottom - by) };
}

/** The padding that puts a `content`-sized box exactly over `rect` of the box the padding makes. */
export function fitInsets(rect: ViewRect, content: { w: number; h: number }): ShapeInsets {
  const perW = content.w / Math.max(1, rect.right - rect.left);
  const perH = content.h / Math.max(1, rect.bottom - rect.top);
  const up = (n: number) => Math.ceil(n * 100) / 100;
  return {
    top: up(perH * rect.top),
    right: up(perW * (100 - rect.right)),
    bottom: up(perH * (100 - rect.bottom)),
    left: up(perW * rect.left),
  };
}
