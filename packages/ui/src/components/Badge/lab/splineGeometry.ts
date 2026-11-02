import { clamp } from '@weasel-js/geom';
import type { SplineAnchor, SplineMode } from './splineAnchors';

export interface Point { x: number; y: number }

/** A line through `(ox, oy)` along the unit vector `(nx, ny)`. */
export interface Axis { nx: number; ny: number; ox: number; oy: number }

/** The editor's radial extent, in viewBox units. */
const MAX_RADIUS = 71;
/** The closest a dragged anchor may come to a neighbor along the curve. */
const NEIGHBOR_GAP = 0.005;

const toHalf = (v: number): number => Math.round(v * 2) / 2;

/** The angle the curve's far end sits at: the diagonal for an octant, the next cardinal for a quadrant. */
export function maxAngle(mode: SplineMode): number {
  return mode === 'octant' ? Math.PI / 4 : Math.PI / 2;
}

/** An octant's anchors sit at θ = arcsin(s) / 2, so s = sin(2θ); a quadrant's are linear in θ. */
export function sToTheta(mode: SplineMode, s: number): number {
  return mode === 'octant' ? Math.asin(clamp(s, 0, 1)) / 2 : clamp(s, 0, 1) * (Math.PI / 2);
}

export function thetaToS(mode: SplineMode, theta: number): number {
  return mode === 'octant' ? Math.sin(2 * clamp(theta, 0, Math.PI / 4)) : clamp(theta / (Math.PI / 2), 0, 1);
}

/** Where radius `r` at curve position `s` lands in the editor, whose y axis points down. */
export function polarPoint(mode: SplineMode, s: number, r: number): Point {
  const theta = sToTheta(mode, s);
  return { x: r * Math.cos(theta), y: -r * Math.sin(theta) };
}

export function sampleCurve(mode: SplineMode, evalAtS: (s: number) => number, steps = 192): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => polarPoint(mode, i / steps, evalAtS(i / steps)));
}

/** The curve position and radius under an editor point, clamped to the editor's sector. */
export function pointToPolar(mode: SplineMode, point: Point): { s: number; r: number } {
  const theta = clamp(Math.atan2(-point.y, Math.max(0.001, point.x)), 0, maxAngle(mode));
  return { s: thetaToS(mode, theta), r: clamp(Math.hypot(point.x, point.y), 0, MAX_RADIUS) };
}

/** Where an alt-click at `point` would insert an anchor. */
export function insertionAt(mode: SplineMode, point: Point): { s: number; r: number } {
  const { s, r } = pointToPolar(mode, point);
  return { s, r: toHalf(r) };
}

/** An end anchor dragged to `point`: it stays on its ray, so only its radius follows. */
export function dragEnd(mode: SplineMode, end: 'first' | 'last', point: Point, w: number): SplineAnchor {
  const theta = end === 'first' ? 0 : maxAngle(mode);
  const along = point.x * Math.cos(theta) + -point.y * Math.sin(theta);
  return { s: end === 'first' ? 0 : 1, r: toHalf(clamp(along, 0, MAX_RADIUS)), w };
}

/** Interior anchor `idx` dragged to `point`, held between its neighbors so the anchors stay in order. */
export function dragInterior(mode: SplineMode, anchors: readonly SplineAnchor[], idx: number, point: Point): SplineAnchor {
  const { s, r } = pointToPolar(mode, point);
  const held = Math.max(anchors[idx - 1].s + NEIGHBOR_GAP, Math.min(anchors[idx + 1].s - NEIGHBOR_GAP, s));
  return { s: Math.round(held * 1000) / 1000, r: toHalf(r), w: anchors[idx].w };
}

export function projectOntoAxis(axis: Axis, point: Point): Point {
  const along = (point.x - axis.ox) * axis.nx + (point.y - axis.oy) * axis.ny;
  return { x: axis.ox + along * axis.nx, y: axis.oy + along * axis.ny };
}

/** The curve's normal at the sample nearest `point`, pointing toward `point`. */
export function normalAxisAt(samples: readonly Point[], point: Point): Axis {
  let closest = 0;
  let best = Infinity;
  samples.forEach((sample, k) => {
    const d2 = (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2;
    if (d2 < best) {
      best = d2;
      closest = k;
    }
  });
  const prev = samples[Math.max(0, closest - 1)];
  const next = samples[Math.min(samples.length - 1, closest + 1)];
  const tx = next.x - prev.x;
  const ty = next.y - prev.y;
  const length = Math.hypot(tx, ty) || 1;
  const origin = samples[closest];
  const flip = (point.x - origin.x) * (-ty / length) + (point.y - origin.y) * (tx / length) < 0 ? -1 : 1;
  return { nx: (flip * -ty) / length, ny: (flip * tx) / length, ox: origin.x, oy: origin.y };
}

/** An anchor's weight after one wheel notch: scrolling up adds a tenth. */
export function wheelWeight(w: number, deltaY: number): number {
  return clamp(Math.round((w + (deltaY > 0 ? -0.1 : 0.1)) * 10) / 10, 0, 3);
}
