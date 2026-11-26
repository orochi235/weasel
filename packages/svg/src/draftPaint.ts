/** An SVG paint and stroke lowered onto the kit data a draft carries, rebased onto the draft's own box. */
import { mapFillPaint } from './fillPaint';
import { hasMarker, solid } from '@weasel-js/paint';
import { paintToBoundsUnits, type Paint, type Stroke } from '@weasel-js/core';
import type { StyledRun } from '@weasel-js/text';
import type { SvgDraftBounds } from './draftPose';
import type { SvgPaint, SvgStroke } from './types';

/** Lower an `SvgPaint` onto the paint of the `kit:path` painter's
 *  `data.fill` — a `Paint`, or `null` for SVG's `fill="none"` (the painter
 *  skips the fill rather than falling back to its default).
 *
 *  A `userSpaceOnUse` gradient is rebased onto the leaf's own box, so it
 *  survives the fit-clamp and the drop-point placement that move the
 *  geometry out from under it. */
export function fillDataFromSvg(
  paint: SvgPaint | undefined,
  box: SvgDraftBounds,
): Paint | null | undefined {
  if (!paint) return undefined;
  if (paint.kind === 'none') return null;
  if (paint.kind === 'solid') {
    return paint.opacity != null ? { ...solid(paint.color), opacity: paint.opacity } : solid(paint.color);
  }
  return fillInBoxFrame(paint.paint, box);
}

/** Lower an `SvgStroke` onto the leaf's `data.stroke`, or `undefined` for one
 *  that paints nothing. One that paints no line but carries a marker comes
 *  through with no paint, since SVG still draws its heads. The paint is
 *  rebased onto the leaf's own box the same way a fill is. */
export function strokeDataFromSvg(
  stroke: SvgStroke | undefined,
  box: SvgDraftBounds,
): Stroke | undefined {
  if (!stroke) return undefined;
  const paint = stroke.paint.kind === 'none' ? null : fillDataFromSvg(stroke.paint, box);
  if (!paint && !hasMarker(stroke)) return undefined;
  return {
    ...(paint ? { paint: stroke.opacity !== undefined ? { ...paint, opacity: stroke.opacity } : paint } : {}),
    width: stroke.width,
    ...(stroke.cap !== undefined ? { cap: stroke.cap } : {}),
    ...(stroke.join !== undefined ? { join: stroke.join } : {}),
    ...(stroke.dash !== undefined ? { dash: stroke.dash } : {}),
    ...(stroke.dashOffset ? { dashOffset: stroke.dashOffset } : {}),
    ...(stroke.miterLimit !== undefined ? { miterLimit: stroke.miterLimit } : {}),
    ...(stroke.align !== undefined ? { align: stroke.align } : {}),
    ...(stroke.markerStart !== undefined ? { markerStart: stroke.markerStart } : {}),
    ...(stroke.markerMid !== undefined ? { markerMid: stroke.markerMid } : {}),
    ...(stroke.markerEnd !== undefined ? { markerEnd: stroke.markerEnd } : {}),
    ...(stroke.vertexWidths !== undefined ? { vertexWidths: stroke.vertexWidths } : {}),
    ...(stroke.nib !== undefined ? { nib: stroke.nib } : {}),
    ...(stroke.varyingWidthJoinThreshold !== undefined ? { varyingWidthJoinThreshold: stroke.varyingWidthJoinThreshold } : {}),
    ...(stroke.trim !== undefined ? { trim: stroke.trim } : {}),
  };
}

/** Rebase a `userSpaceOnUse` gradient onto the leaf's own box. A text node's
 *  paint is already a kit `Paint`, so it comes here directly. */
export function fillInBoxFrame(fill: Paint, box: SvgDraftBounds): Paint {
  const units = 'units' in fill ? fill.units : undefined;
  return units === 'world' ? paintToBoundsUnits(fill, box) : fill;
}

/** The same rebase for a run's own overrides, which `<tspan fill="url(#g)">`
 *  puts on the run rather than on the node. */
export function runInBoxFrame(run: StyledRun, box: SvgDraftBounds): StyledRun {
  const fill = run.fill ? mapFillPaint(run.fill, (p) => fillInBoxFrame(p, box)) : run.fill;
  const stroke = run.stroke ? strokeInBoxFrame(run.stroke, box) : run.stroke;
  if (fill === run.fill && stroke === run.stroke) return run;
  return { ...run, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) };
}

/** The same rebase for a `Stroke`'s paint. A stroke with no paint of its own
 *  passes through — there is nothing to rebase. */
export function strokeInBoxFrame(stroke: Stroke, box: SvgDraftBounds): Stroke {
  if (!stroke.paint) return stroke;
  const paint = fillInBoxFrame(stroke.paint, box);
  return paint === stroke.paint ? stroke : { ...stroke, paint };
}
