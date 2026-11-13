/**
 * The style axis of a font variant, one declaration for the whole stack.
 *
 * Written inline as `'normal' | 'italic'` in half a dozen places before this,
 * across the font/text package line — identical value sets, so nothing could
 * drift until someone added `'oblique'`, and then it would have drifted
 * silently in every place that had not been found.
 */
export type FontStyle = 'normal' | 'italic';

/** Which face within a family. Defaults to weight 400, style `'normal'`. */
export interface FontVariant {
  weight?: number;
  style?: FontStyle;
}

/** `v` with its defaults filled in. */
export function normalizeVariant(v: FontVariant): { weight: number; style: FontStyle } {
  return { weight: v.weight ?? 400, style: v.style ?? 'normal' };
}
