import type { ShapeInsets } from '../types';
import type { BaseSampler } from './types';

/** A rectangle in viewBox coordinates (0..100). */
export interface ViewRect { left: number; top: number; right: number; bottom: number }

type Point = readonly [number, number];

const CENTER = 50;
/** viewBox units between outline samples. */
const STEP = 0.5;
/** As far as a corner of the outline can reach between two samples. */
const MARGIN = STEP / 2;

/** `sampler`'s outline as points, for a sampler built in a 100 by 100 box. */
export function outlinePoints(sampler: BaseSampler): [number, number][] {
  const count = Math.ceil(sampler.totalCss / STEP);
  return Array.from({ length: count }, (_, i) => {
    const p = sampler.perimeterAt((i / count) * sampler.totalCss);
    return [p.x, p.y] as [number, number];
  });
}

/**
 * Calls `visit` with every rectangle around the viewBox's center that holds none of `points`
 * and cannot grow sideways, clipped to the viewBox. With the points an outline whose inside
 * holds the center, any rectangle inside the outline around the center lies in one of them.
 */
function eachClearRect(points: readonly Point[], visit: (rect: ViewRect) => void): void {
  // Nearest the center first: a top or bottom edge moving outward takes points in one by one.
  const above = points.filter((p) => p[1] < CENTER).sort((a, b) => b[1] - a[1]);
  const below = points.filter((p) => p[1] > CENTER).sort((a, b) => a[1] - b[1]);
  const narrow = (span: [number, number], x: number) => {
    if (x <= CENTER) span[0] = Math.max(span[0], x);
    if (x >= CENTER) span[1] = Math.min(span[1], x);
  };
  const upper: [number, number] = [0, 100];
  for (const p of points) if (p[1] === CENTER) narrow(upper, p[0]);
  for (let i = 0; i <= above.length; i++) {
    const top = i < above.length ? above[i][1] : 0;
    const span: [number, number] = [upper[0], upper[1]];
    for (let j = 0; j <= below.length; j++) {
      visit({ left: span[0], top, right: span[1], bottom: j < below.length ? below[j][1] : 100 });
      if (j < below.length) narrow(span, below[j][0]);
    }
    if (i < above.length) narrow(upper, above[i][0]);
  }
}

/** The largest rectangle around the viewBox's center that holds none of `points`. */
export function inscribedRect(points: readonly Point[]): ViewRect {
  let best: ViewRect = { left: CENTER, top: CENTER, right: CENTER, bottom: CENTER };
  let bestArea = 0;
  eachClearRect(points, (r) => {
    const area = (r.right - r.left) * (r.bottom - r.top);
    if (area > bestArea) [best, bestArea] = [r, area];
  });
  return best;
}

/**
 * The least padding on the two sides of one axis, each at least its floor, that leaves the
 * first `before` and the last `after` of the padded length (as shares of it) clear of content.
 */
function fitAxis(content: number, before: number, after: number, floor: readonly [number, number]): [number, number] | null {
  if (before + after >= 0.95) return null;
  const pads = (length: number): [number, number] => [Math.max(floor[0], before * length), Math.max(floor[1], after * length)];
  // Each side is either at its floor or at its share, which gives four lengths to try.
  const lengths = [
    content + floor[0] + floor[1],
    (content + floor[1]) / (1 - before),
    (content + floor[0]) / (1 - after),
    content / (1 - before - after),
  ].sort((a, b) => a - b);
  for (const length of lengths) {
    const [a, b] = pads(length);
    if (content + a + b <= length + 1e-9) return [a, b];
  }
  return null;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * The padding, no side under `floor`, that keeps a `content`-sized box `clear` px from the
 * outline `points` describe, in the smallest box that does. `floor` itself when that already does.
 */
export function fitInsets(points: readonly Point[], content: { w: number; h: number }, floor: ShapeInsets, clear = 0): ShapeInsets {
  if (clear <= 0) return fitTouching(points, content, floor);
  // Content `clear` from the outline is content grown by `clear` on every side that touches it.
  const within = (n: number) => Math.max(0, n - clear);
  const grown = fitTouching(
    points,
    { w: content.w + 2 * clear, h: content.h + 2 * clear },
    { top: within(floor.top), right: within(floor.right), bottom: within(floor.bottom), left: within(floor.left) },
  );
  const insets = { top: grown.top + clear, right: grown.right + clear, bottom: grown.bottom + clear, left: grown.left + clear };
  return SIDES.every((side) => Math.abs(insets[side] - floor[side]) < 1e-9) ? floor : insets;
}

function fitTouching(points: readonly Point[], content: { w: number; h: number }, floor: ShapeInsets): ShapeInsets {
  const width = content.w + floor.left + floor.right;
  const height = content.h + floor.top + floor.bottom;
  const held: ViewRect = {
    left: (floor.left / width) * 100,
    right: ((floor.left + content.w) / width) * 100,
    top: (floor.top / height) * 100,
    bottom: ((floor.top + content.h) / height) * 100,
  };
  if (!points.some(([x, y]) => x > held.left && x < held.right && y > held.top && y < held.bottom)) return floor;

  let best = floor;
  let bestArea = Infinity;
  eachClearRect(points, (r) => {
    const x = fitAxis(content.w, (r.left + MARGIN) / 100, (100 - r.right + MARGIN) / 100, [floor.left, floor.right]);
    const y = fitAxis(content.h, (r.top + MARGIN) / 100, (100 - r.bottom + MARGIN) / 100, [floor.top, floor.bottom]);
    if (!x || !y) return;
    const area = (content.w + x[0] + x[1]) * (content.h + y[0] + y[1]);
    if (area < bestArea) [best, bestArea] = [{ left: x[0], right: x[1], top: y[0], bottom: y[1] }, area];
  });
  const up = (n: number) => Math.ceil(n * 100) / 100;
  return { top: up(best.top), right: up(best.right), bottom: up(best.bottom), left: up(best.left) };
}
