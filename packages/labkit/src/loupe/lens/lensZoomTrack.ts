import { ellipseShape, type TrackShape } from '@weasel-js/geom';
import type { AlongArc } from '@weasel-js/ui/components/Along';
import type { LoupeShape } from '../types';

/** The rim's zoom runs across the bottom, through 6 o'clock, clear of 3 and 9. */
const START = 252;
const END = 108;
/** Px from the body's edge to the zoom's centerline: past the rim, with room for the stop labels outside the band. */
export const ZOOM_INSET = 24;

/** The track a body's zoom lies along: an arc on a round body, an ellipse on a stretched one, straight on a square. */
export type ZoomTrack =
  | { kind: 'arc'; arc: AlongArc }
  | { kind: 'ellipse'; shape: (box: { width: number; height: number }) => TrackShape }
  | { kind: 'line' };

const ARC: ZoomTrack = {
  kind: 'arc',
  arc: { start: START, end: END, direction: 'ccw', inset: ZOOM_INSET },
};
const ELLIPSE: ZoomTrack = {
  kind: 'ellipse',
  shape: ({ width, height }) =>
    ellipseShape({
      center: { x: width / 2, y: height / 2 },
      radiusX: Math.max(0, width / 2 - ZOOM_INSET),
      radiusY: Math.max(0, height / 2 - ZOOM_INSET),
      start: START,
      end: END,
      direction: 'ccw',
    }),
};
const LINE: ZoomTrack = { kind: 'line' };

/** The zoom track for a body of `shape` drawn `size` px; a round body under half a px out of true is a circle. */
export function zoomTrackOf(shape: LoupeShape, size: { width: number; height: number }): ZoomTrack {
  if (shape === 'square') return LINE;
  return Math.abs(size.width - size.height) < 0.5 ? ARC : ELLIPSE;
}
