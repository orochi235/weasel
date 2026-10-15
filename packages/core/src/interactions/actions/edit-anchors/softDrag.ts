/**
 * The soft-selection half of an anchor drag: which anchors follow the dragged
 * ones and by how much, and the band of path that shows it.
 */
import type { OngoingOverlay } from '@weasel-js/routing';
import {
  measureAnchorPath,
  softSelectionBand,
  softSelectionWeights,
  translateAnchorBy,
  type AnchorPathMeasure,
  type AnchorSet,
  type SoftFalloff,
} from '@weasel-js/geom';
import type { SoftSelectionParams } from './params';

/** Captured at press; `radiusPx` and `weights` change as the wheel scrubs. */
export interface SoftDrag {
  readonly measure: AnchorPathMeasure;
  readonly dragging: readonly number[];
  readonly falloff: SoftFalloff;
  radiusPx: number;
  weights: Map<number, number>;
}

const MIN_RADIUS_PX = 2;
const MAX_RADIUS_PX = 4000;
/** Radius growth per pixel of wheel travel: a notch of about 100 scales it by ~1.16. */
const WHEEL_GAIN = 0.0015;

/** Soft selection over `origin` for a drag of `dragging`, measured in screen
 *  pixels at `scale`. */
export function startSoftDrag(
  origin: AnchorSet,
  dragging: readonly number[],
  params: SoftSelectionParams,
  scale: { x: number; y: number } | undefined,
): SoftDrag {
  const measure = measureAnchorPath(origin, scale ? { scale } : {});
  const falloff = params.falloff ?? 'smooth';
  const radiusPx = clampRadius(params.radiusPx);
  return { measure, dragging, falloff, radiusPx, weights: softSelectionWeights(measure, dragging, radiusPx, falloff) };
}

/** Scrub the radius by a wheel's `deltaY`: up grows it. Returns the new radius. */
export function scrubSoftRadius(drag: SoftDrag, deltaY: number): number {
  drag.radiusPx = clampRadius(drag.radiusPx * Math.exp(-deltaY * WHEEL_GAIN));
  drag.weights = softSelectionWeights(drag.measure, drag.dragging, drag.radiusPx, drag.falloff);
  return drag.radiusPx;
}

/** Move every weighted anchor of `set` by its share of `(dx, dy)`. */
export function softTranslate(set: AnchorSet, drag: SoftDrag, dx: number, dy: number): void {
  for (const [flat, w] of drag.weights) translateAnchorBy(set, flat, dx * w, dy * w);
}

/** The band of `current` within the radius, as `falloff` overlays. */
export function softBandOverlays(drag: SoftDrag, current: AnchorSet): OngoingOverlay[] {
  return softSelectionBand(drag.measure, current, drag.dragging, drag.radiusPx)
    .map((points) => ({ kind: 'polyline', points, role: 'falloff' }));
}

function clampRadius(px: number): number {
  return Math.min(MAX_RADIUS_PX, Math.max(MIN_RADIUS_PX, Number.isFinite(px) ? px : MIN_RADIUS_PX));
}
