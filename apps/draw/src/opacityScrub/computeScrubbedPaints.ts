import { paintAlpha, paintWithAlpha } from '@weasel-js/paint';
import { resolveFill, resolveStroke } from '@weasel-js/core';
import type { Stroke, Fill } from '@weasel-js/core';

/** A node's paints as stored. */
export interface PaintSnapshot {
  fill?: Fill | null;
  stroke?: Stroke | null;
}

/** The higher of a snapshot's fill and stroke opacity; 0 when neither paints. */
export function brightestAlphaOf(snapshot: PaintSnapshot): number {
  const fill = resolveFill(snapshot.fill);
  const stroke = resolveStroke(snapshot.stroke);
  return Math.max(fill ? paintAlpha(fill.paint) : 0, stroke ? paintAlpha(stroke.paint) : 0);
}

/**
 * Scale fill and stroke opacity by `targetAlpha / base`, so a paint at `base`
 * lands on `targetAlpha` and every ratio between paints is kept. `base` is the
 * brightest alpha across what is being scrubbed together, and defaults to this
 * snapshot's own. With `base` 0 there is no ratio to keep, so each paint takes
 * `targetAlpha` itself. A fill or stroke that paints nothing passes through
 * unchanged. `targetAlpha` and every result are clamped to [0, 1].
 */
export function computeScrubbedPaints(
  snapshot: PaintSnapshot,
  targetAlpha: number,
  base: number = brightestAlphaOf(snapshot),
): PaintSnapshot {
  const clamped = Math.max(0, Math.min(1, targetAlpha));
  const scaled = (alpha: number) => (base === 0 ? clamped : Math.min(1, (alpha * clamped) / base));

  const fillPaint = resolveFill(snapshot.fill)?.paint;
  const strokePaint = resolveStroke(snapshot.stroke)?.paint;

  return {
    fill: snapshot.fill && fillPaint
      ? { ...snapshot.fill, paint: paintWithAlpha(fillPaint, scaled(paintAlpha(fillPaint))) }
      : snapshot.fill,
    stroke: snapshot.stroke && strokePaint
      ? { ...snapshot.stroke, paint: paintWithAlpha(strokePaint, scaled(paintAlpha(strokePaint))) }
      : snapshot.stroke,
  };
}
