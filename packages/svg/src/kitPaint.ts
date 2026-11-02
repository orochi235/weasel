/** A kit paint and stroke as the `SvgPaint` and `SvgStroke` an element is written with. */
import { fillInPoseFrame, resolveStroke, type Paint, type PoseLinear, type Stroke } from '@weasel-js/core';
import type { SvgPaint, SvgStroke } from './types';

/** A leaf's box: where it is drawn, and the frame its box-relative paints
 *  resolve against. */
export interface SvgKitPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** Carried onto a text or image node. A path node has nowhere to hold it,
   *  so a path leaf's is baked into its geometry with its rotation. */
  transform?: PoseLinear;
}

/** A kit paint as an `SvgPaint`. `null` is `fill="none"`; a box-relative
 *  gradient or pattern is resolved into `box`, since the geometry it paints
 *  is written already placed there. */
export function svgPaintFromKit(fill: Paint | null, box: SvgKitPose): SvgPaint {
  if (fill === null) return { kind: 'none' };
  if (fill.kind === undefined || fill.kind === 'solid') {
    return { kind: 'solid', color: fill.color, ...(fill.opacity != null ? { opacity: fill.opacity } : {}) };
  }
  return { kind: 'gradient', paint: fillInPoseFrame(fill, box) };
}

/** A kit `Stroke` as an `SvgStroke` — the inverse of `strokeDataFromSvg`.
 *  One with no paint or no width draws nothing and is written as no stroke. */
export function svgStrokeFromKit(raw: Stroke | null | undefined, box: SvgKitPose): SvgStroke | undefined {
  const stroke = resolveStroke(raw);
  if (!stroke) return undefined;
  const width = stroke.width ?? 1;
  if (!((typeof width === 'object' ? width.px : width) > 0)) return undefined;
  const opacity = stroke.paint.opacity;
  return {
    paint: svgPaintFromKit(stroke.paint, box),
    width,
    ...(opacity != null ? { opacity } : {}),
    ...(stroke.cap !== undefined ? { cap: stroke.cap } : {}),
    ...(stroke.join !== undefined ? { join: stroke.join } : {}),
    ...(stroke.dash !== undefined ? { dash: stroke.dash } : {}),
    ...(stroke.miterLimit !== undefined ? { miterLimit: stroke.miterLimit } : {}),
    ...(stroke.align !== undefined ? { align: stroke.align } : {}),
    ...(stroke.markerStart !== undefined ? { markerStart: stroke.markerStart } : {}),
    ...(stroke.markerMid !== undefined ? { markerMid: stroke.markerMid } : {}),
    ...(stroke.markerEnd !== undefined ? { markerEnd: stroke.markerEnd } : {}),
    ...(stroke.vertexWidths?.length ? { vertexWidths: stroke.vertexWidths } : {}),
    ...(stroke.nib ? { nib: stroke.nib } : {}),
    ...(stroke.trim !== undefined ? { trim: stroke.trim } : {}),
  };
}
