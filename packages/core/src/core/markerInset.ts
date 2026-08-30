/**
 * Resolving a `MarkerRef` to the distance the ribbon must stop short.
 *
 * The tessellation layer takes these as plain numbers and knows nothing about
 * the registry — keeping that layer free of upward dependencies is deliberate.
 * The ribbon cache, the SVG serializer and `inkReach` all resolve through here,
 * so the ribbon, the export and the hit region cannot disagree about where the
 * line ends.
 */

import type { MarkerRef, Stroke } from '@weasel-js/paint';
import { getMarker } from './strokeMarkers';

/** The size of one marker unit, in the same world units as `strokeWidth`. */
export function resolveMarkerSize(ref: MarkerRef, strokeWidth: number): number {
  if (typeof ref === 'string' || ref.size === undefined) return strokeWidth;
  const { size } = ref;
  return typeof size === 'number' ? size : size.px;
}

export function markerKeyOf(ref: MarkerRef): string {
  return typeof ref === 'string' ? ref : ref.key;
}

/**
 * How far back the ribbon stops for `ref`, in world units. Zero for an absent
 * marker, an unregistered key, or an open head — never throws, because an
 * unknown key is a data problem and dropping the head is the graceful answer.
 */
export function markerInset(ref: MarkerRef | undefined, strokeWidth: number): number {
  if (ref === undefined) return 0;
  const entry = getMarker(markerKeyOf(ref));
  if (entry === undefined) return 0;
  return (entry.inset ?? 0) * resolveMarkerSize(ref, strokeWidth);
}

/** The start and end insets a stroke asks for. `markerMid` never insets —
 *  trimming at an interior vertex would cut the line in two. */
export function strokeInsets(stroke: Stroke, strokeWidth: number): { start: number; end: number } {
  return {
    start: markerInset(stroke.markerStart, strokeWidth),
    end: markerInset(stroke.markerEnd, strokeWidth),
  };
}
