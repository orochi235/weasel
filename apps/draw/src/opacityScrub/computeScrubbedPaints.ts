import { toHex8, getAlpha01, withAlpha01 } from '@orochi235/weasel';

export interface PaintSnapshot {
  fill: string | null;
  stroke: string | null;
}

function isHexColor(v: string | null): v is string {
  return typeof v === 'string' && v.startsWith('#');
}

/**
 * Scale both fill and stroke alpha by the same factor so the brighter of
 * the two lands on `targetAlpha`. Preserves the ratio between fill α and
 * stroke α. Non-hex paints (null, gradients, etc.) pass through unchanged.
 * targetAlpha is clamped to [0, 1].
 */
export function computeScrubbedPaints(
  snapshot: PaintSnapshot,
  targetAlpha: number,
): PaintSnapshot {
  const clamped = Math.max(0, Math.min(1, targetAlpha));

  const fillHex = isHexColor(snapshot.fill) ? toHex8(snapshot.fill) : null;
  const strokeHex = isHexColor(snapshot.stroke) ? toHex8(snapshot.stroke) : null;

  const fillA = fillHex ? getAlpha01(fillHex) : 0;
  const strokeA = strokeHex ? getAlpha01(strokeHex) : 0;
  const brightest = Math.max(fillA, strokeA);

  const factor = brightest === 0 ? 0 : clamped / brightest;

  return {
    fill: fillHex ? withAlpha01(fillHex, fillA * factor) : snapshot.fill,
    stroke: strokeHex ? withAlpha01(strokeHex, strokeA * factor) : snapshot.stroke,
  };
}
