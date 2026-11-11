import type { TrackMap } from './slider';

/** A stretch of values: a track's whole range, or the part of it a track shows. */
export interface Span {
  from: number;
  to: number;
}

/** Where `v` sits along `span`, as a fraction: 0 at `from`, 1 at `to`, and outside that past either end.
 *  0 for an empty span. */
export function spanPlace(span: Span, v: number): number {
  const length = span.to - span.from;
  return length === 0 ? 0 : (v - span.from) / length;
}

/** The value at fraction `f` of `span`. */
export function spanValue(span: Span, f: number): number {
  return span.from + f * (span.to - span.from);
}

/** A length as a fraction of `span`'s. Unlike {@link spanPlace} it measures no position, so `span.from` has no say. */
export function spanShare(span: Span, length: number): number {
  const whole = span.to - span.from;
  return whole === 0 ? 0 : length / whole;
}

/** `span` laid linearly along a track: the map {@link sliderAt} and {@link attract} read. Unclamped, so a
 *  place off either end of the track maps to a value outside the span. */
export function spanMap(span: Span): TrackMap {
  return { toFraction: (v) => spanPlace(span, v), toValue: (f) => spanValue(span, f) };
}

/** `span` moved inside `bounds`, keeping its length, or shortened to `bounds` where it is the longer. */
export function spanHold(span: Span, bounds: Span): Span {
  if (span.from >= bounds.from && span.to <= bounds.to) return { from: span.from, to: span.to };
  const length = Math.min(span.to - span.from, bounds.to - bounds.from);
  let from = span.from;
  if (from < bounds.from) from = bounds.from;
  if (from + length > bounds.to) from = Math.max(bounds.from, bounds.to - length);
  return { from, to: Math.min(bounds.to, from + length) };
}

/** `span` shifted by `by` inside `bounds`, keeping its length. */
export function spanPan(span: Span, by: number, bounds: Span): Span {
  return spanHold({ from: span.from + by, to: span.to + by }, bounds);
}

/** `span` scaled by `factor` about `at`, which keeps its place along the track unless `bounds` push it.
 *  A `factor` below 1 narrows. The result is no shorter than `minLength` and no longer than `bounds`. */
export function spanZoom(span: Span, at: number, factor: number, bounds: Span, minLength = 0): Span {
  const length = span.to - span.from;
  const next = Math.min(bounds.to - bounds.from, Math.max(minLength, length * factor));
  const f = length === 0 ? 0.5 : (at - span.from) / length;
  return spanHold({ from: at - f * next, to: at + (1 - f) * next }, bounds);
}
