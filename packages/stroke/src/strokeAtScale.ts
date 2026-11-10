import { scaledDash, type MarkerRef, type Stroke } from '@weasel-js/paint';
import { resolveMarkerSize } from './markerInset';
import { resolveStrokeWidth } from './tessellate/stroke';

/**
 * `stroke` with every `{ px }` length resolved at `scale` screen pixels per
 * world unit, as the renderer resolves them under a uniform view: the width,
 * each marker size, and on a `{ px }` width its dashes.
 */
export function strokeAtScale(stroke: Stroke, scale: number): Stroke & { width: number } {
  const width = resolveStrokeWidth(stroke.width ?? 1, scale);
  // Dashes resolve as the width does, a non-finite or zero scale leaving both as given.
  const out: Stroke & { width: number } = typeof stroke.width === 'object'
    ? { ...scaledDash(stroke, resolveStrokeWidth({ px: 1 }, scale)), width } : { ...stroke, width };
  for (const role of ['markerStart', 'markerMid', 'markerEnd'] as const) {
    const ref: MarkerRef | undefined = stroke[role];
    if (typeof ref === 'object' && typeof ref.size === 'object') {
      out[role] = { ...ref, size: resolveMarkerSize(ref, width, scale) };
    }
  }
  return out;
}
