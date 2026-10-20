/**
 * The candidate lines a search runs along: every inflated obstacle's edges,
 * every stop's own lines, and the middle of each channel between two facing
 * obstacles — only those inside the search window.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Box } from './types';

/** The sorted, distinct x and y lines of one search. */
export interface GridLines {
  xs: number[];
  ys: number[];
}

const EPS = 1e-7;

/** The box around `points` grown by `margin`, which a search first looks in. */
export function searchWindow(points: readonly Vec2[], margin: number): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0 - margin, y: y0 - margin, width: x1 - x0 + 2 * margin, height: y1 - y0 + 2 * margin };
}

/** Whether `inner` lies within `outer`. */
export const within = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

/** `values` sorted, with repeats closer than `EPS` dropped. */
function distinct(values: number[]): number[] {
  values.sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of values) if (out.length === 0 || v - out[out.length - 1]! > EPS) out.push(v);
  return out;
}

/** The midlines of the channels along one axis: between each box and the
 *  nearest one past it that faces it across that axis, when they do not touch. */
function midlines(boxes: readonly Box[], axis: 'x' | 'y'): number[] {
  const lo = (b: Box) => (axis === 'x' ? b.x : b.y);
  const size = (b: Box) => (axis === 'x' ? b.width : b.height);
  const crossLo = (b: Box) => (axis === 'x' ? b.y : b.x);
  const crossSize = (b: Box) => (axis === 'x' ? b.height : b.width);
  const out: number[] = [];
  for (const a of boxes) {
    const end = lo(a) + size(a);
    let nearest = Infinity;
    for (const b of boxes) {
      if (b === a || lo(b) <= end) continue;
      const facing = crossLo(a) < crossLo(b) + crossSize(b) && crossLo(b) < crossLo(a) + crossSize(a);
      if (facing && lo(b) < nearest) nearest = lo(b);
    }
    if (nearest !== Infinity) out.push((end + nearest) / 2);
  }
  return out;
}

/** The lines inside `window` for a search among `boxes`, the inflated
 *  obstacles near it, through `points`: its ends and stops. */
export function gridLines(window: Box, boxes: readonly Box[], points: readonly Vec2[]): GridLines {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const b of boxes) {
    xs.push(b.x, b.x + b.width);
    ys.push(b.y, b.y + b.height);
  }
  xs.push(...midlines(boxes, 'x'));
  ys.push(...midlines(boxes, 'y'));
  const inX = (v: number) => v >= window.x - EPS && v <= window.x + window.width + EPS;
  const inY = (v: number) => v >= window.y - EPS && v <= window.y + window.height + EPS;
  const keptX = xs.filter(inX);
  const keptY = ys.filter(inY);
  for (const p of points) {
    keptX.push(p.x);
    keptY.push(p.y);
  }
  return { xs: distinct(keptX), ys: distinct(keptY) };
}
