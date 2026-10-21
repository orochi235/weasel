import { arcShape, trackRun, type ArcTrackSpec, type Point, type TrackNearest, type TrackPlace, type TrackRun, type TrackShape } from '@weasel-js/geom';

/** The handles the lab's arc is edited by: each is a scene node, and its center is what the arc reads. */
export type HandleId = 'center' | 'radius' | 'start' | 'end' | 'probe';
export const HANDLE_IDS: readonly HandleId[] = ['center', 'radius', 'start', 'end', 'probe'];

/** A handle's box: centered on its point, `HANDLE` px across. */
export const HANDLE = 14;

export interface HandleNode {
  id: HandleId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HandlePoints = Record<HandleId, Point>;

/** Degrees clockwise from 12 o'clock of `p` about `c`, in [0, 360): the arc's own terms. */
export function bearing(p: Point, c: Point): number {
  const deg = (Math.atan2(p.x - c.x, c.y - p.y) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** The point `deg` clockwise from 12 o'clock on the circle of `r` about `c`. */
export function onCircle(c: Point, r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: c.x + r * Math.sin(rad), y: c.y - r * Math.cos(rad) };
}

/**
 * The arc the handles describe: centered on `center`, as far out as `radius` is from it, from the bearing of
 * `start` to the bearing of `end`. How far `start` and `end` lie from the center does not matter.
 */
export function specFromHandles(h: HandlePoints, direction: 'cw' | 'ccw'): ArcTrackSpec {
  return {
    center: h.center,
    radius: Math.hypot(h.radius.x - h.center.x, h.radius.y - h.center.y),
    start: round(bearing(h.start, h.center)),
    end: round(bearing(h.end, h.center)),
    direction,
  };
}

/** Whole degrees, so a handle dropped by hand reads as the angle it is near. */
const round = (deg: number): number => Math.round(deg) % 360;

/** Where each handle sits for `spec`: the angle handles on the circle, the radius handle at the arc's middle. */
export function handlesFor(spec: ArcTrackSpec, probe: Point): HandlePoints {
  const shape = arcShape(spec);
  return {
    center: spec.center,
    radius: shape.at(0.5).point,
    start: onCircle(spec.center, spec.radius, spec.start),
    end: onCircle(spec.center, spec.radius, spec.end),
    probe,
  };
}

export function handleNode(id: HandleId, p: Point): HandleNode {
  return { id, x: p.x - HANDLE / 2, y: p.y - HANDLE / 2, width: HANDLE, height: HANDLE };
}

/** One station of the lab's run: where it is along the run, and how an item placed there stands. */
export interface Station extends TrackPlace {
  g: number;
}

/** Everything the lab draws and reads out for one arc and probe. */
export interface TrackMeasure {
  spec: ArcTrackSpec;
  shape: TrackShape;
  run: TrackRun;
  sweep: number;
  stations: Station[];
  probe: Point;
  /** `nearest` on the shape, in the shape's own direction. */
  onShape: TrackNearest;
  onShapeOpen: TrackNearest;
  /** `nearest` on the run, in reading order. */
  onRun: TrackNearest;
  onRunOpen: TrackNearest;
}

/** The arc's sweep in degrees, as `arcShape` reads it: equal ends are a whole circle. */
export function sweepOf(spec: ArcTrackSpec): number {
  const sign = spec.direction === 'ccw' ? -1 : 1;
  const raw = (((sign * (spec.end - spec.start)) % 360) + 360) % 360;
  return raw === 0 ? 360 : raw;
}

export function measureTrack(spec: ArcTrackSpec, probe: Point, stations: number): TrackMeasure {
  const shape = arcShape(spec);
  const run = trackRun(shape);
  const n = Math.max(2, stations);
  return {
    spec,
    shape,
    run,
    sweep: sweepOf(spec),
    stations: Array.from({ length: n }, (_, i) => ({ g: i / (n - 1), ...run.at(i / (n - 1)) })),
    probe,
    onShape: shape.nearest(probe),
    onShapeOpen: shape.nearest(probe, { open: true }),
    onRun: run.nearest(probe),
    onRunOpen: run.nearest(probe, { open: true }),
  };
}

/** Which way a run reads across the screen at its middle, in words. */
export function readingWords(run: TrackRun): string {
  const { tangent } = run.at(0.5);
  if (Math.abs(tangent.x) >= Math.abs(tangent.y)) return tangent.x >= 0 ? 'left to right' : 'right to left';
  return tangent.y >= 0 ? 'top to bottom' : 'bottom to top';
}
