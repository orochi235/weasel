import type { CSSProperties } from 'react';
import { placeOnRun } from '../Along/placeOnRun';
import { lineShape, trackRun, type Point, type TrackRun } from '@weasel-js/geom';

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

const OPEN = { open: true };

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
      return { g, gRaw: run.nearest(p, OPEN).f, dist, across: acrossAt(run, g, p), length: width, thickness: height };
    },
  };
}

/** How far `p` lies off `run` along its normal at `g`. */
function acrossAt(run: TrackRun, g: number, p: Point): number {
  const { point, normal } = run.at(g);
  return Math.abs((p.x - point.x) * normal.x + (p.y - point.y) * normal.y);
}

/** A band's thickness: the track height it inherits, else 24px. A custom property computes to the text it was given, so
 *  a px height is read there and any other from the stroke width it sets, which is 1px wherever the stylesheet is absent. */
function thicknessOf(band: SVGElement | null): number {
  if (!band) return 24;
  const style = getComputedStyle(band);
  const height = style.getPropertyValue('--rp-track-height').trim();
  const w = /^[\d.]+px$/.test(height) ? Number.parseFloat(height) : height ? Number.parseFloat(style.strokeWidth) : Number.NaN;
  return w > 0 ? w : 24;
}

/** A geometry along `run`, in the coordinates of `root`'s box: parts are tipped to the run, pointers projected onto it. */
export function curvedGeometry(run: TrackRun, root: () => HTMLElement | null, band: () => SVGElement | null): SliderGeometry {
  return {
    curved: true,
    place: (g) => placeOnRun(run, g),
    measure: (clientX, clientY) => {
      const el = root();
      if (!el) return null;
      const { left, top } = el.getBoundingClientRect();
      const p = { x: clientX - left, y: clientY - top };
      const { f: g, dist } = run.nearest(p);
      return { g, gRaw: run.nearest(p, OPEN).f, dist, across: acrossAt(run, g, p), length: run.length, thickness: thicknessOf(band()) };
    },
  };
}
