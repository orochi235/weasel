import { linearScale, type LinearScale } from '@weasel-js/plot/scales';
import type { Span } from '@weasel-js/ui-input';
import { spanPlace, spanShare } from '@weasel-js/ui-input';

/** A visible span of timeline time, in ms. */
export type TimeWindow = Span;

/** Narrowest window the user can zoom to, in ms. Below this the playhead and
 *  the keys it sits between stop being separable at any sane track width. */
export const MIN_SPAN_MS = 1;

/** The window laid across a track `widthPx` wide: ms to px along it, and back. */
export function windowScale(window: TimeWindow, widthPx: number): LinearScale {
  return linearScale({ domain: [window.from, window.to], range: [0, widthPx] });
}

/** Where `ms` sits in the window, as a fraction, and a duration as a fraction of it. */
export { spanPlace as toFraction, spanShare as spanFraction };

/** Where `ms` sits in the window, as a CSS percentage. */
export function toPercent(window: TimeWindow, ms: number): string {
  return `${spanPlace(window, ms) * 100}%`;
}

/** A duration as a CSS percentage, for a width. */
export function spanPercent(window: TimeWindow, ms: number): string {
  return `${spanShare(window, ms) * 100}%`;
}

/** Minimum gap between time ticks, in px — the ruler's and the graph grid's. */
export const TICK_SPACING_PX = 64;
