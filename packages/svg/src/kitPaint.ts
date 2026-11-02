/** A kit paint and stroke as the `SvgPaint` and `SvgStroke` an element is written with. */
import { fillInPoseFrame, resolveStroke, type Paint, type Path, type Stroke } from '@weasel-js/core';
import { spanOnPath, trimSpan } from '@weasel-js/stroke';
import type { SvgKitPose } from './fromKit';
import type { SvgPaint, SvgStroke } from './types';

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

const NOTHING = { start: 1, end: 0 } as const;

/**
 * `stroke` with its trim, measured along `local` as the ribbon measures it,
 * restated as lengths along `drawn`: `local` carried through the pose frame
 * the stroke is drawn in, anchor for anchor.
 */
export function strokeTrimOnPath(stroke: SvgStroke, local: Path, drawn: Path): SvgStroke {
  if (stroke.trim === undefined) return stroke;
  const span = trimSpan(local, stroke.trim);
  const on = span && spanOnPath(span, local, drawn);
  return { ...stroke, trim: on ? { start: { length: on.from }, end: { length: on.to } } : NOTHING };
}
