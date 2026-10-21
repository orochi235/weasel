import type { DrawCommand } from '@weasel-js/core/renderer';
import { circlePath, polylineFromPoints, type Point } from '@weasel-js/geom';
import { HANDLE, onCircle, type HandleId, type HandlePoints, type TrackMeasure } from './trackGeometry';

const INK = { color: '#2b3440' };
const MUTED = { color: '#9aa4ae' };
const RUN = { color: '#2f7fd0' };
const ITEM = { color: '#e08a1e' };
const PROBE = { color: '#c0392b' };
const START = { color: '#2e9e5b' };
const END = { color: '#b0413e' };
const WHITE = { color: '#ffffff' };

/** What each handle is drawn in. */
export const HANDLE_PAINT: Record<HandleId, { color: string }> = { center: INK, radius: RUN, start: START, end: END, probe: PROBE };

const add = (p: Point, v: Point, k: number): Point => ({ x: p.x + v.x * k, y: p.y + v.y * k });
const line = (pts: Point[], paint: { color: string }, px = 1, dash?: number[]): DrawCommand => ({
  kind: 'path',
  path: polylineFromPoints(pts),
  stroke: { paint, width: { px }, dash },
});
const dot = (p: Point, r: number, paint: { color: string }): DrawCommand => ({ kind: 'path', path: circlePath(p.x, p.y, r), fill: { paint } });
const ring = (p: Point, r: number, paint: { color: string }): DrawCommand => ({
  kind: 'path',
  path: circlePath(p.x, p.y, r),
  fill: { paint: WHITE },
  stroke: { paint, width: { px: 1.5 } },
});

/** A chevron at `p` pointing along `dir`. */
function chevron(p: Point, dir: Point, size: number, paint: { color: string }): DrawCommand {
  const back = add(p, dir, -size);
  const side = { x: -dir.y, y: dir.x };
  return line([add(back, side, size * 0.7), p, add(back, side, -size * 0.7)], paint, 2);
}

/** An item as the run places it at a station: a box standing on the run's up, with a notch on its top edge. */
function item(at: Point, along: Point, up: Point): DrawCommand[] {
  const w = 18;
  const h = 10;
  const c = add(at, up, 26);
  const corner = (a: number, b: number) => add(add(c, along, (a * w) / 2), up, (b * h) / 2);
  return [
    line([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)], ITEM, 1.5),
    line([add(c, up, h / 2), add(c, up, h / 2 + 5)], ITEM, 2),
  ];
}

/** The arc, its circle, its stations and the items they would stand, its reading direction, and the probe's
 *  nearest spots, closed and open. */
export function drawTrack(m: TrackMeasure, handles: HandlePoints): DrawCommand[] {
  const { spec, shape, run } = m;
  const out: DrawCommand[] = [];
  const full = Array.from({ length: 97 }, (_, i) => onCircle(spec.center, spec.radius, (i * 360) / 96));
  out.push(line(full, MUTED, 1, [4, 4]));
  for (const id of ['radius', 'start', 'end'] as const) out.push(line([spec.center, handles[id]], MUTED, 1, [2, 3]));
  out.push(line(Array.from({ length: 97 }, (_, i) => shape.at(i / 96).point), INK, 3));
  for (const f of [0.25, 0.5, 0.75]) {
    const s = shape.at(f);
    out.push(chevron(add(s.point, s.normal, -10), s.tangent, 5, MUTED));
  }
  for (const s of m.stations) {
    out.push(line([s.point, add(s.point, s.normal, 16)], RUN, 1.5));
    out.push(...item(s.point, s.tangent, s.normal));
  }
  const mid = run.at(0.5);
  const tail = add(mid.point, mid.normal, 52);
  out.push(line([add(tail, mid.tangent, -24), add(tail, mid.tangent, 24)], RUN, 2), chevron(add(tail, mid.tangent, 24), mid.tangent, 7, RUN));
  out.push(dot(shape.at(0).point, 5, START), dot(shape.at(1).point, 5, END));

  const near = shape.at(m.onShape.f).point;
  out.push(line([m.probe, near], PROBE, 1, [3, 3]), dot(near, 4, PROBE));
  const f = m.onShapeOpen.f;
  if (f < 0 || f > 1) {
    const sign = spec.direction === 'ccw' ? -1 : 1;
    out.push(ring(onCircle(spec.center, spec.radius, spec.start + sign * f * m.sweep), 4, PROBE));
  }
  return out;
}

/** A handle as the scene draws it. */
export function drawHandle(id: HandleId, x: number, y: number): DrawCommand[] {
  const c = { x: x + HANDLE / 2, y: y + HANDLE / 2 };
  const paint = HANDLE_PAINT[id];
  if (id === 'center') return [ring(c, HANDLE / 2 - 1, paint), dot(c, 2, paint)];
  if (id === 'probe') return [dot(c, HANDLE / 2 - 1, paint)];
  return [ring(c, HANDLE / 2 - 1, paint), dot(c, 3, paint)];
}
