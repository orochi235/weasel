import type { Fill, Paint, Stroke } from './paint';

/** A fill or stroke field holding this takes its holder's source's, whole. */
export const INHERIT = 'inherit';
export type Inherit = typeof INHERIT;

/** A fill that paints. */
export type PaintedFill = Fill & { paint: Paint };
/** A stroke that paints. */
export type PaintedStroke = Stroke & { paint: Paint };

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

/** {@link resolveFill} for a stroke. Width is not consulted: a stroke whose
 *  base width is 0 can still draw through its per-vertex widths. */
export function resolveStroke(
  stroke: Stroke | Inherit | null | undefined,
  inherited: PaintedStroke | null = null,
): PaintedStroke | null {
  if (stroke === INHERIT) return inherited;
  return stroke?.paint == null ? null : (stroke as PaintedStroke);
}
