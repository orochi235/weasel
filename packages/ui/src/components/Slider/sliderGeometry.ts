import type { CSSProperties } from 'react';
import { boxPoint } from '../Along/boxPoint';
import { placeOnRun } from '../Along/placeOnRun';
import { lineShape, trackRun, type Point, type TrackRun } from '@weasel-js/geom';
import { layoutBox } from './useBoxes';

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

/** A straight, left-to-right geometry along the rail's centerline, in the rail's own px. A pointer is mapped through
 *  the screen matrix of `frame`, an SVG drawn across the rail, so a rotated ancestor maps it back. */
export function lineGeometry(rail: () => HTMLElement | null, frame: () => SVGGraphicsElement | null): SliderGeometry {
  return {
    curved: false,
    place: (g) => ({ left: `${g * 100}%` }),
    measure: (clientX, clientY) => {
      const el = rail();
      if (!el) return null;
      // Without a screen matrix (jsdom) the rail's client rect is the frame, as it is for any untransformed rail.
      const f = frame();
      const matrixed = f?.getScreenCTM?.() ? f : null;
      const p = boxPoint(matrixed ?? el, clientX, clientY);
      const { width, height } = matrixed ? layoutBox(el) : el.getBoundingClientRect();
      const run = trackRun(lineShape({ x: 0, y: height / 2 }, { x: width, y: height / 2 }));
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

/** Where no stylesheet applies, the band thickness `Slider.module.css` defaults to: half its 14px tick. */
const UNSTYLED_THICKNESS = 7;

/** A band's thickness: the face's stroke width. A px track height is read straight off the custom property, so it is
 *  right where no stylesheet applies; there the face's stroke width is the initial 1px or nothing at all. */
function thicknessOf(band: SVGElement | null): number {
  if (!band) return UNSTYLED_THICKNESS;
  const style = getComputedStyle(band);
  const height = style.getPropertyValue('--rp-track-height').trim();
  if (/^[\d.]+px$/.test(height)) return Number.parseFloat(height);
  const w = Number.parseFloat(style.strokeWidth);
  return w > 1 ? w : UNSTYLED_THICKNESS;
}

/** A geometry along `run`, in the coordinates of the box `band` is drawn across: parts are tipped to the run, pointers
 *  projected onto it. */
export function curvedGeometry(run: TrackRun, band: () => SVGGraphicsElement | null): SliderGeometry {
  return {
    curved: true,
    place: (g) => placeOnRun(run, g),
    measure: (clientX, clientY) => {
      const el = band();
      if (!el) return null;
      const p = boxPoint(el, clientX, clientY);
      const { f: g, dist } = run.nearest(p);
      return { g, gRaw: run.nearest(p, OPEN).f, dist, across: acrossAt(run, g, p), length: run.length, thickness: thicknessOf(el) };
    },
  };
}
