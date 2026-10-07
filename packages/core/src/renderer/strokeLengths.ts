import type { FillStyle, MarkerRef, Stroke } from '@weasel-js/paint';
import type { PathDrawCommand } from './DrawCommand';
import { mat3, type GlMat3 } from './math/mat3';
import { resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import { strokeSpaceOf, type StrokeMetric } from 'features/paths/tessellate/metric';
import { quantizeStrokeScale } from './cache/strokeMeshCache';
import { resolveMarkerSize } from '../core/markerInset';

/** A path command whose stroke paints. */
export type StrokedPathCommand = PathDrawCommand & { stroke: Stroke & { paint: FillStyle } };

/** A stroke command ready to tessellate, and the space to tessellate it in. */
export interface ResolvedStrokeCommand {
  cmd: StrokedPathCommand;
  /** Present when the stroke's width is `{ px }` and the transform stretches
   *  one direction more than another: the ribbon and its heads are built in
   *  this space, and every length in `cmd` is measured there. */
  metric?: StrokeMetric;
  /** Screen pixels per unit of `cmd`'s lengths, wherever `metric` is set. */
  pxPerUnit: number;
}

/**
 * `cmd` with its `{ px }` lengths — the stroke width, any marker size, and on a
 * `{ px }` stroke its dashes — resolved against the accumulated transform's
 * quantized scale, so everything downstream (the ribbon cache key, the insets,
 * the heads) sees plain numbers.
 *
 * A `{ px }` width also takes the transform's stretch: the ribbon is built
 * where lengths measure as they do on screen, so it is exact across, down and
 * on every diagonal rather than right only on average.
 */
export function resolveStrokeLengths(transform: GlMat3, cmd: StrokedPathCommand): ResolvedStrokeCommand {
  const stroke = cmd.stroke;
  const { markerStart, markerMid, markerEnd } = stroke;
  if (typeof stroke.width !== 'object' && !isPxMarker(markerStart)
    && !isPxMarker(markerMid) && !isPxMarker(markerEnd)) {
    return { cmd, pxPerUnit: 1 };
  }
  const resolved: Stroke & { paint: FillStyle } = { ...stroke };
  let scale = mat3.meanScaleOf(transform);
  let metric: StrokeMetric | undefined;
  let pxPerUnit = 1;
  if (typeof stroke.width === 'object') {
    const space = strokeSpaceOf(transform[0], transform[1], transform[3], transform[4]);
    scale = space.scale;
    metric = space.metric ?? undefined;
    pxPerUnit = quantizeStrokeScale(stroke.width.px, scale);
    resolved.width = resolveStrokeWidth(stroke.width, pxPerUnit);
    if (stroke.dash && pxPerUnit > 0) resolved.dash = stroke.dash.map((d) => d / pxPerUnit);
  }
  if (isPxMarker(markerStart)) resolved.markerStart = resolvedMarker(markerStart, scale);
  if (isPxMarker(markerMid)) resolved.markerMid = resolvedMarker(markerMid, scale);
  if (isPxMarker(markerEnd)) resolved.markerEnd = resolvedMarker(markerEnd, scale);
  return { cmd: { ...cmd, stroke: resolved }, metric, pxPerUnit };
}

type PxMarker = Exclude<MarkerRef, string> & { size: { px: number } };

function isPxMarker(ref: MarkerRef | undefined): ref is PxMarker {
  return typeof ref === 'object' && typeof ref.size === 'object';
}

function resolvedMarker(ref: PxMarker, scale: number): MarkerRef {
  return { ...ref, size: resolveMarkerSize(ref, 0, quantizeStrokeScale(ref.size.px, scale)) };
}
