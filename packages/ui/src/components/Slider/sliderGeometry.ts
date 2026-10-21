import type { CSSProperties } from 'react';
import { lineShape, trackRun } from '@weasel-js/geom';

/** Where a client point falls on a slider's value span. */
export interface SliderMeasure {
  /** 0..1 along the value span in reading order. */
  g: number;
  /** The same, unclamped past the ends (a line extends straight): what shift-drag differences. */
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
      const at = run.at(g);
      const across = Math.abs((p.x - at.point.x) * at.normal.x + (p.y - at.point.y) * at.normal.y);
      return { g, gRaw: (clientX - left) / width, dist, across, length: width, thickness: height };
    },
  };
}
