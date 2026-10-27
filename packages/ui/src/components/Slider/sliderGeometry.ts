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
  /** How far the slider reaches across its span in px: the band or the stop ticks over it, whichever is thicker.
   *  What a drag has to clear to drop a thumb. */
  reach: number;
}

/** What a slider's pointers and parts ask of the shape it lies along. */
export interface SliderGeometry {
  readonly curved: boolean;
  /** The inline direction values run in: from the right end under `'rtl'`. */
  readonly direction: 'ltr' | 'rtl';
  /** The style that puts a part at `g` along the span. */
  place(g: number): CSSProperties;
  /** Null before the slider is mounted. */
  measure(clientX: number, clientY: number): SliderMeasure | null;
}

const OPEN = { open: true };

/** Reaches off the centerline past which a drag drops a thumb. */
export const DROP_OFF = 1.5;

/** A straight geometry along the rail's centerline, in the rail's own px, its values running from the right end under
 *  `'rtl'`. A pointer is mapped through the screen matrix of `frame`, an SVG drawn across the rail, so a rotated ancestor
 *  maps it back. */
export function lineGeometry(rail: () => HTMLElement | null, frame: () => SVGGraphicsElement | null, direction: 'ltr' | 'rtl' = 'ltr'): SliderGeometry {
  return {
    curved: false,
    direction,
    place: (g) => ({ left: `${(direction === 'rtl' ? 1 - g : g) * 100}%` }),
    measure: (clientX, clientY) => {
      const el = rail();
      if (!el) return null;
      // Without a screen matrix (jsdom) the rail's client rect is the frame, as it is for any untransformed rail.
      const f = frame();
      const matrixed = f?.getScreenCTM?.() ? f : null;
      const p = boxPoint(matrixed ?? el, clientX, clientY);
      const { width, height } = matrixed ? layoutBox(el) : el.getBoundingClientRect();
      const run = trackRun(lineShape({ x: 0, y: height / 2 }, { x: width, y: height / 2 }), 0, 1, { direction });
      const { f: g, dist } = run.nearest(p);
      return { g, gRaw: run.nearest(p, OPEN).f, dist, across: acrossAt(run, g, p), length: width, thickness: height, reach: height };
    },
  };
}

/** How far `p` lies off `run` along its normal at `g`. */
function acrossAt(run: TrackRun, g: number, p: Point): number {
  const { point, normal } = run.at(g);
  return Math.abs((p.x - point.x) * normal.x + (p.y - point.y) * normal.y);
}

/** Where no stylesheet applies, the stop tick length `Slider.module.css` defaults to, and its band: half of it. */
const UNSTYLED_TICK = 14;
const UNSTYLED_THICKNESS = UNSTYLED_TICK / 2;

/** A px custom property on `style`, or null where it is unset or not in px. */
function pxProperty(style: CSSStyleDeclaration, name: string): number | null {
  const value = style.getPropertyValue(name).trim();
  return /^[\d.]+px$/.test(value) ? Number.parseFloat(value) : null;
}

/** A band's thickness: the face's stroke width. A px track height is read straight off the custom property, so it is
 *  right where no stylesheet applies; there the face's stroke width is the initial 1px or nothing at all. */
function thicknessOf(band: SVGElement | null): number {
  if (!band) return UNSTYLED_THICKNESS;
  const style = getComputedStyle(band);
  const height = pxProperty(style, '--rp-track-height');
  if (height !== null) return height;
  const w = Number.parseFloat(style.strokeWidth);
  return w > 1 ? w : UNSTYLED_THICKNESS;
}

/** What a curved slider reaches across its run: its band, or its stop ticks where they are longer. */
function reachOf(band: SVGElement | null, thickness: number): number {
  const tick = band ? pxProperty(getComputedStyle(band), '--rp-tick-length') : null;
  return Math.max(thickness, tick ?? UNSTYLED_TICK);
}

/** A geometry along `run`, in the coordinates of the box `band` is drawn across: parts are tipped to the run, pointers
 *  projected onto it. */
export function curvedGeometry(run: TrackRun, band: () => SVGGraphicsElement | null): SliderGeometry {
  return {
    curved: true,
    direction: run.direction,
    place: (g) => placeOnRun(run, g),
    measure: (clientX, clientY) => {
      const el = band();
      if (!el) return null;
      const p = boxPoint(el, clientX, clientY);
      const { f: g, dist } = run.nearest(p);
      const thickness = thicknessOf(el);
      return { g, gRaw: run.nearest(p, OPEN).f, dist, across: acrossAt(run, g, p), length: run.length, thickness, reach: reachOf(el, thickness) };
    },
  };
}
