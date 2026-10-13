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

/** Padding on the two sides of one axis: each at least its `floor`, and each at least the share of the padded length that `before` and `after` take. */
function fitAxis(content: number, before: number, after: number, floor: [number, number]): [number, number] {
  let pad = floor;
  // The length depends on the padding and the padding on the length; the shares sum to under 1, so this settles.
  for (let i = 0; i < 40; i++) {
    const length = content + pad[0] + pad[1];
    pad = [Math.max(floor[0], before * length), Math.max(floor[1], after * length)];
  }
  return pad;
}

/**
 * The least padding, no side under `floor`, that keeps a `content`-sized box inside `rect` of
 * the box the padding makes.
 */
export function fitInsets(rect: ViewRect, content: { w: number; h: number }, floor: ShapeInsets): ShapeInsets {
  // A rectangle with no room in it would ask for endless padding.
  const share = (from: number, to: number): [number, number] => {
    const scale = Math.min(1, 0.9 / Math.max(1e-6, (from + 100 - to) / 100));
    return [(from / 100) * scale, ((100 - to) / 100) * scale];
  };
  const [left, right] = fitAxis(content.w, ...share(rect.left, rect.right), [floor.left, floor.right]);
  const [top, bottom] = fitAxis(content.h, ...share(rect.top, rect.bottom), [floor.top, floor.bottom]);
  const up = (n: number) => Math.ceil(n * 100) / 100;
  return { top: up(top), right: up(right), bottom: up(bottom), left: up(left) };
}
