/** The cut polyline itself: where it crosses itself, and the loops it closes inside a path. */

import { pointInPolygon } from '../polyline';
import type { Point } from '../paths/cubicMath';
import { type Contour, evalSeg, reverseContour, sampleContour, signedArea } from './contourSegments';
import { type Crossing, findCrossings } from './cutCrossings';
import { windingAt, negligibleArea } from './contours';

export function distinctPoints(cut: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of cut) {
    const q = out[out.length - 1];
    if (!q || q.x !== p.x || q.y !== p.y) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** The stretch of the cut from one crossing to a later one. */
export function cutBetween(cut: Point[], from: Crossing, to: Crossing): Point[] {
  const out = [from.pt];
  for (let v = Math.floor(from.s) + 1; v < to.s; v++) out.push(cut[v]);
  out.push(to.pt);
  return out;
}

/** Where segments p0→p1 and q0→q1 cross at a point interior to both, or null. */
function properCrossing(p0: Point, p1: Point, q0: Point, q1: Point): Point | null {
  const r = { x: p1.x - p0.x, y: p1.y - p0.y };
  const s = { x: q1.x - q0.x, y: q1.y - q0.y };
  const den = r.x * s.y - r.y * s.x;
  if (den === 0) return null;
  const qp = { x: q0.x - p0.x, y: q0.y - p0.y };
  const t = (qp.x * s.y - qp.y * s.x) / den;
  const u = (qp.x * r.y - qp.y * r.x) / den;
  const eps = 1e-9;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { x: p0.x + t * r.x, y: p0.y + t * r.y };
}

/**
 * `run` split where it crosses its own track: each loop it closes, as the
 * ring of points from the crossing round to it again, and the spine left once
 * every loop is taken out. Loops are taken as they close, so each is simple.
 * A run ending where it started is itself a loop, and leaves no spine.
 */
export function splitLoops(run: Point[]): { spine: Point[]; loops: Point[][] } {
  const spine = [run[0]];
  const loops: Point[][] = [];
  for (let i = 1; i < run.length; i++) {
    const to = run[i];
    for (;;) {
      const from = spine[spine.length - 1];
      let hit: { j: number; x: Point; d: number } | null = null;
      for (let j = 0; j + 2 < spine.length; j++) {
        const x = properCrossing(from, to, spine[j], spine[j + 1]);
        if (!x) continue;
        const d = Math.hypot(x.x - from.x, x.y - from.y);
        if (!hit || d < hit.d) hit = { j, x, d };
      }
      if (!hit) { spine.push(to); break; }
      loops.push([hit.x, ...spine.slice(hit.j + 1)]);
      spine.length = hit.j + 1;
      spine.push(hit.x);
    }
  }
  const last = spine[spine.length - 1];
  if (spine.length >= 4 && last.x === spine[0].x && last.y === spine[0].y) {
    loops.push(spine.slice(0, -1));
    return { spine: [], loops };
  }
  return { spine, loops };
}

/** The point at position `s` along the cut. */
function pointAt(cut: Point[], s: number): Point {
  const k = Math.min(Math.floor(s), cut.length - 2);
  const f = s - k;
  const a = cut[k], b = cut[k + 1];
  return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
}

/**
 * A closed cut that crosses the boundary, turned to start and end outside
 * the fill so its chords read enter-then-exit like any other cut's. Any other
 * cut comes back unchanged.
 */
export function openClosedCut(cut: Point[], boundaries: Contour[]): Point[] {
  const n = cut.length - 1;
  if (n < 3 || cut[0].x !== cut[n].x || cut[0].y !== cut[n].y) return cut;
  const crossings = findCrossings(boundaries, cut);
  const k = crossings.findIndex((c) => !c.enters);
  if (k < 0) return cut;
  const next = k + 1 < crossings.length ? crossings[k + 1].s : crossings[0].s + n;
  const s = ((crossings[k].s + next) / 2) % n;
  const seg = Math.min(Math.floor(s), n - 1);
  const start = pointAt(cut, s);
  const ring = cut.slice(0, n);
  return distinctPoints([start, ...ring.slice(seg + 1), ...ring.slice(0, seg + 1), start]);
}

/**
 * The loops the cut closes inside the fill, each a ring of points. A loop
 * lies within one stretch of the cut between boundary crossings, so it
 * crosses no boundary. One that a chord of the cut, or an earlier loop, runs
 * through is left out.
 */
export function interiorLoops(cut: Point[], boundaries: Contour[]): Point[][] {
  const crossings = findCrossings(boundaries, cut);
  const chords: Point[][] = [];
  for (let k = 0; k + 1 < crossings.length; k++) {
    const c0 = crossings[k], c1 = crossings[k + 1];
    if (c0.enters && !c1.enters && c1.s - c0.s > 1e-9) chords.push(splitLoops(cutBetween(cut, c0, c1)).spine);
  }

  const last = cut.length - 1;
  const stops = [{ s: 0, pt: cut[0] }, ...crossings, { s: last, pt: cut[last] }];
  const rings: Point[][] = [];
  const loops: Point[][] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i], b = stops[i + 1];
    if (b.s - a.s <= 1e-9) continue;
    if (windingAt(pointAt(cut, (a.s + b.s) / 2), boundaries) === 0) continue;
    const run = [a.pt];
    for (let v = Math.floor(a.s) + 1; v < b.s; v++) run.push(cut[v]);
    run.push(b.pt);
    for (const loop of splitLoops(distinctPoints(run)).loops) {
      const ring = [...loop, loop[0]];
      if (chords.some((c) => polylinesCross(ring, c)) || rings.some((r) => polylinesCross(ring, r))) continue;
      rings.push(ring);
      loops.push(loop);
    }
  }
  return loops;
}

/**
 * Cut each loop out of the region holding it: the loop, with whatever of that
 * region it encloses, becomes a region of its own, and the loop becomes a hole
 * in what is left. Edits `regions` in place; returns whether any loop cut.
 */
export function cutOutLoops(regions: Contour[][], loops: Point[][]): boolean {
  let cut = false;
  const minArea = negligibleArea(regions.flat());
  for (const loop of loops) {
    let ring: Contour = loop.map((p, i) => [p, loop[(i + 1) % loop.length]]);
    const a = signedArea(ring);
    if (Math.abs(a) <= minArea) continue;
    if (a < 0) ring = reverseContour(ring);
    const probe = evalSeg(ring[0], 0.5);
    const at = regions.findIndex((r) => windingAt(probe, r) !== 0);
    if (at < 0) continue;
    const samples = sampleContour(ring);
    const within = (c: Contour): boolean => {
      const p = evalSeg(c[0], 0.5);
      return pointInPolygon(samples, p.x, p.y);
    };
    const region = regions[at];
    regions[at] = [...region.filter((c) => !within(c)), reverseContour(ring)];
    regions.push([ring, ...region.filter(within)]);
    cut = true;
  }
  return cut;
}

export function polylinesCross(a: Point[], b: Point[]): boolean {
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      if (properCrossing(a[i], a[i + 1], b[j], b[j + 1])) return true;
    }
  }
  return false;
}
