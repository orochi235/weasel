import { paintAlpha, paintWithAlpha } from '@weasel-js/core';
import type { FillStyle, Stroke } from '@weasel-js/core';

export interface PaintSnapshot {
  fill: FillStyle | null;
  stroke: Stroke | null;
}

/**
 * Scale both fill and stroke opacity by the same factor so the brighter of
 * the two lands on `targetAlpha`. Preserves the ratio between the two.
 * An absent paint passes through unchanged. `targetAlpha` is clamped to
 * [0, 1].
 */
export function computeScrubbedPaints(
  snapshot: PaintSnapshot,
  targetAlpha: number,
): PaintSnapshot {
  const clamped = Math.max(0, Math.min(1, targetAlpha));

  const fillA = snapshot.fill ? paintAlpha(snapshot.fill) : 0;
  const strokeA = snapshot.stroke ? paintAlpha(snapshot.stroke.paint) : 0;
  const brightest = Math.max(fillA, strokeA);

  const factor = brightest === 0 ? 0 : clamped / brightest;

  return {
    fill: snapshot.fill ? paintWithAlpha(snapshot.fill, fillA * factor) : null,
    stroke: snapshot.stroke
      ? { ...snapshot.stroke, paint: paintWithAlpha(snapshot.stroke.paint, strokeA * factor) }
      : null,
  };
}
