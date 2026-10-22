import { paintAlpha, paintWithAlpha, resolveFill, resolveStroke } from '@weasel-js/core';
import type { Stroke, Fill } from '@weasel-js/core';

/** A node's paints as stored. */
export interface PaintSnapshot {
  fill?: Fill | null;
  stroke?: Stroke | null;
}

/**
 * Scale both fill and stroke opacity by the same factor so the brighter of
 * the two lands on `targetAlpha`. Preserves the ratio between the two.
 * A fill or stroke that paints nothing passes through unchanged. `targetAlpha` is clamped to [0, 1].
 */
export function computeScrubbedPaints(
  snapshot: PaintSnapshot,
  targetAlpha: number,
): PaintSnapshot {
  const clamped = Math.max(0, Math.min(1, targetAlpha));

  const fillPaint = resolveFill(snapshot.fill)?.paint;
  const strokePaint = resolveStroke(snapshot.stroke)?.paint;
  const fillA = fillPaint ? paintAlpha(fillPaint) : 0;
  const strokeA = strokePaint ? paintAlpha(strokePaint) : 0;
  const brightest = Math.max(fillA, strokeA);

  const factor = brightest === 0 ? 0 : clamped / brightest;

  return {
    fill: snapshot.fill && fillPaint
      ? { ...snapshot.fill, paint: paintWithAlpha(fillPaint, fillA * factor) }
      : snapshot.fill,
    stroke: snapshot.stroke && strokePaint
      ? { ...snapshot.stroke, paint: paintWithAlpha(strokePaint, strokeA * factor) }
      : snapshot.stroke,
  };
}
