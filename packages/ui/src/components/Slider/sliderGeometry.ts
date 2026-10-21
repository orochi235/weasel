import type { CSSProperties } from 'react';
import { lineShape, trackRun, type ArcTrackShape, type Point, type TrackRun, type TrackShape } from '@weasel-js/geom';

/** Where a client point falls on a slider's value span. */
export interface SliderMeasure {
  /** 0..1 along the value span in reading order. */
  g: number;
  /** The same, unclamped past the ends (a line extends straight, an arc by angle): what shift-drag differences. */
  gRaw: number;
  /** Distance from the point to its nearest spot on the span, in px. */
  dist: number;
  /** Distance off the span along its normal, in px. */
  across: number;
  /** The span's length in px: what the stop-snap distance is divided by. */
  length: number;
  /** The band's thickness in px. */
  thickness: number;
}

/** What a slider's pointers and parts ask of the shape it lies along. */
export interface SliderGeometry {
  readonly curved: boolean;
  /** The style that puts a part at `g` along the span. */
  place(g: number): CSSProperties;
  /** Null before the slider is mounted. */
  measure(clientX: number, clientY: number): SliderMeasure | null;
}

/** Band thicknesses off the centerline past which a drag drops a thumb. */
export const DROP_OFF = 1.5;

/** A straight, left-to-right geometry measured against the rail's box on every call. */
export function lineGeometry(rail: () => HTMLElement | null): SliderGeometry {
  return {
    curved: false,
    place: (g) => ({ left: `${g * 100}%` }),
    measure: (clientX, clientY) => {
      const el = rail();
      if (!el) return null;
      const { left, top, width, height } = el.getBoundingClientRect();
      const y = top + height / 2;
      const run = trackRun(lineShape({ x: left, y }, { x: left + width, y }));
      const p = { x: clientX, y: clientY };
      const { f: g, dist } = run.nearest(p);
      return { g, gRaw: (clientX - left) / width, dist, across: acrossAt(run, g, p), length: width, thickness: height };
    },
  };
}

/** How far `p` lies off `run` along its normal at `g`. */
function acrossAt(run: TrackRun, g: number, p: Point): number {
  const { point, normal } = run.at(g);
  return Math.abs((p.x - point.x) * normal.x + (p.y - point.y) * normal.y);
}

const isArc = (s: TrackShape): s is ArcTrackShape => s.kind === 'arc' && 'arc' in s;
const mod360 = (a: number): number => ((a % 360) + 360) % 360;

/** `p`'s place along `run` with the ends left open: on an arc, by its angle, unwrapped about the arc's middle. */
function unclampedAt(run: TrackRun, p: Point, g: number): number {
  const span = run.to - run.from;
  if (!isArc(run.shape) || span === 0) return g;
  const { center, start, end, direction } = run.shape.arc;
  const sign = direction === 'ccw' ? -1 : 1;
  const sweep = mod360(sign * (end - start)) || 360;
  const angle = (Math.atan2(p.x - center.x, center.y - p.y) * 180) / Math.PI;
  const offset = sweep / 2 + mod360(sign * (angle - start) - sweep / 2 + 180) - 180;
  const f = offset / sweep;
  return run.reversed ? (run.to - f) / span : (f - run.from) / span;
}

/** A band's thickness: the track height it inherits, else the stylesheet's 24px default. Read from the custom
 *  property rather than `stroke-width`, which reads as its initial 1px wherever the stylesheet has not applied. */
function thicknessOf(band: SVGElement | null): number {
  const w = band ? Number.parseFloat(getComputedStyle(band).getPropertyValue('--rp-track-height')) : Number.NaN;
  return w > 0 ? w : 24;
}

/** A geometry along `run`, in the coordinates of `root`'s box: parts are tipped to the run, pointers projected onto it. */
export function curvedGeometry(run: TrackRun, root: () => HTMLElement | null, band: () => SVGElement | null): SliderGeometry {
  return {
    curved: true,
    place: (g) => {
      const { point, angle } = run.at(g);
      return { '--at-x': `${point.x}px`, '--at-y': `${point.y}px`, '--at-angle': `${angle}deg` } as CSSProperties;
    },
    measure: (clientX, clientY) => {
      const el = root();
      if (!el) return null;
      const { left, top } = el.getBoundingClientRect();
      const p = { x: clientX - left, y: clientY - top };
      const { f: g, dist } = run.nearest(p);
      return { g, gRaw: unclampedAt(run, p, g), dist, across: acrossAt(run, g, p), length: run.length, thickness: thicknessOf(band()) };
    },
  };
}
