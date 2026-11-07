import type { MarkerRef, Stroke } from '@weasel-js/paint';
import { resolveMarkerSize } from './markerInset';
import { resolveStrokeWidth } from './tessellate/stroke';

/**
 * `stroke` with every `{ px }` length resolved at `scale` screen pixels per
 * world unit, as the renderer resolves them under a uniform view: the width,
 * each marker size, and on a `{ px }` width its dashes.
 */
export function strokeAtScale(stroke: Stroke, scale: number): Stroke & { width: number } {
  const width = resolveStrokeWidth(stroke.width ?? 1, scale);
  const out: Stroke & { width: number } = { ...stroke, width };
  if (typeof stroke.width === 'object' && stroke.dash && scale > 0) out.dash = stroke.dash.map((d) => d / scale);
  for (const role of ['markerStart', 'markerMid', 'markerEnd'] as const) {
    const ref: MarkerRef | undefined = stroke[role];
    if (typeof ref === 'object' && typeof ref.size === 'object') {
      out[role] = { ...ref, size: resolveMarkerSize(ref, width, scale) };
    }
  }
  return out;
}
