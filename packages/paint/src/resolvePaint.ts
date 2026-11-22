import type { Fill, Paint, Stroke } from './paint';

/** A fill or stroke field holding this takes its holder's source's, whole. */
export const INHERIT = 'inherit';
/** The type of {@link INHERIT}. */
export type Inherit = typeof INHERIT;

/** A fill that paints. */
export type PaintedFill = Fill & { paint: Paint };
/** A stroke that paints. */
export type PaintedStroke = Stroke & { paint: Paint };
/** A stroke that draws: its line in a paint, or, with no paint, only the marker heads it carries, which SVG draws
 *  whatever the line paints. */
export type DrawnStroke = PaintedStroke | (Stroke & { paint?: undefined });

/**
 * What a fill field means: the fill it paints, or `null` for none. Absent,
 * `null` and a record with no `paint` are all none; a paint with alpha 0 is a
 * paint. {@link INHERIT} is `inherited`, which the caller resolves first.
 */
export function resolveFill(
  fill: Fill | Inherit | null | undefined,
  inherited: PaintedFill | null = null,
): PaintedFill | null {
  if (fill === INHERIT) return inherited;
  return fill?.paint == null ? null : (fill as PaintedFill);
}

/** {@link resolveFill} for a stroke, except that one with no paint carrying a marker still draws its heads. Width
 *  is not consulted here, though a stroke with no width draws nothing, whatever its per-vertex widths:
 *  `strokeHasInk` answers both for the line. */
export function resolveStroke(
  stroke: Stroke | Inherit | null | undefined,
  inherited: DrawnStroke | null = null,
): DrawnStroke | null {
  if (stroke === INHERIT) return inherited;
  if (stroke == null) return null;
  if (stroke.paint != null) return stroke as PaintedStroke;
  return hasMarker(stroke) ? (stroke as DrawnStroke) : null;
}

/** Whether `stroke` carries a marker head at any of its places. */
export function hasMarker(stroke: Pick<Stroke, 'markerStart' | 'markerMid' | 'markerEnd'>): boolean {
  return stroke.markerStart !== undefined || stroke.markerMid !== undefined || stroke.markerEnd !== undefined;
}
