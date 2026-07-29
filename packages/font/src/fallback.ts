/**
 * Cross-family fallback policy. The per-family chain in `resolveFontVariant`
 * (weight → style → synthetic) has always been rich; what was missing is what
 * happens when the family itself was never registered. That case used to
 * render nothing at all, which is the single most common cause of "my text is
 * invisible".
 */

export type FontFallbackPolicy = 'substitute' | 'canvas' | 'none';

let policy: FontFallbackPolicy = 'substitute';
let defaultFamily: string | null = null;

export function setFontFallbackPolicy(next: FontFallbackPolicy): void {
  policy = next;
}

export function getFontFallbackPolicy(): FontFallbackPolicy {
  return policy;
}

/** Explicit default family for `'substitute'`. When unset, the first
 *  registered family wins — the right answer for the common case of an app
 *  that registers exactly one. */
export function setDefaultFontFamily(family: string): void {
  defaultFamily = family;
}

export function getDefaultFontFamily(): string | null {
  return defaultFamily;
}

/** Test helper. Do not call from product code. */
export function _resetFallbackForTests(): void {
  policy = 'substitute';
  defaultFamily = null;
}
