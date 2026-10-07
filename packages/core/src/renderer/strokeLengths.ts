import type { FillStyle, MarkerRef, Stroke } from '@weasel-js/paint';
import type { PathDrawCommand } from './DrawCommand';
import { mat3, type GlMat3 } from './math/mat3';
import { resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import { quantizeStrokeScale } from './cache/strokeMeshCache';
import { resolveMarkerSize } from '../core/markerInset';

/** A path command whose stroke paints. */
export type StrokedPathCommand = PathDrawCommand & { stroke: Stroke & { paint: FillStyle } };

/** `cmd` with its `{ px }` lengths — the stroke width and any marker size —
 *  resolved against the accumulated transform's quantized scale, so everything
 *  downstream (the ribbon cache key, the insets, the heads) sees world units. */
export function withResolvedStrokeLengths(transform: GlMat3, cmd: StrokedPathCommand): StrokedPathCommand {
  const stroke = cmd.stroke;
  const { markerStart, markerMid, markerEnd } = stroke;
  if (typeof stroke.width !== 'object' && !isPxMarker(markerStart)
    && !isPxMarker(markerMid) && !isPxMarker(markerEnd)) {
    return cmd;
  }
  const scale = mat3.meanScaleOf(transform);
  const resolved: Stroke & { paint: FillStyle } = { ...stroke };
  if (typeof stroke.width === 'object') {
    resolved.width = resolveStrokeWidth(stroke.width, quantizeStrokeScale(stroke.width.px, scale));
  }
  if (isPxMarker(markerStart)) resolved.markerStart = resolvedMarker(markerStart, scale);
  if (isPxMarker(markerMid)) resolved.markerMid = resolvedMarker(markerMid, scale);
  if (isPxMarker(markerEnd)) resolved.markerEnd = resolvedMarker(markerEnd, scale);
  return { ...cmd, stroke: resolved };
}

type PxMarker = Exclude<MarkerRef, string> & { size: { px: number } };

function isPxMarker(ref: MarkerRef | undefined): ref is PxMarker {
  return typeof ref === 'object' && typeof ref.size === 'object';
}

function resolvedMarker(ref: PxMarker, scale: number): MarkerRef {
  return { ...ref, size: resolveMarkerSize(ref, 0, quantizeStrokeScale(ref.size.px, scale)) };
}
