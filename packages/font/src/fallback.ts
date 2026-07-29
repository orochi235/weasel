/**
 * Cross-family fallback policy. The per-family chain in `resolveFontVariant`
 * (weight → style → synthetic) has always been rich; what was missing is what
 * happens when the family itself was never registered. That case used to
 * render nothing at all, which is the single most common cause of "my text is
 * invisible".
 */

/**
 * What happens when a requested family has no baked atlas:
 *   - `'substitute'` — render with the default family (see
 *     `setDefaultFontFamily`), reporting the swap on `ResolveResult.substituted`.
 *   - `'canvas'` — auto-enroll the family with the dynamic canvas-SDF
 *     rasterizer. The consumer gets the *real* typeface if the browser has it,
 *     at canvas-SDF quality rather than baked-MSDF quality.
 *   - `'none'` — hard miss; the run renders nothing.
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

/**
 * Warn-once gate for the cross-family fallback warnings. The messages are
 * built in `registerFont.ts` (they read the registry to name the actual gap),
 * but the dedup state lives here so `_resetFallbackForTests` clears it —
 * warnings about a fallback are fallback state. While it sat in
 * `registerFont.ts`, only a registry reset cleared it, and a test that reset
 * just the policy silently swallowed its next warning.
 */
const warnedFallbacks = new Set<string>();

/** @internal Claim `key` for a one-time warning; true the first time only. */
export function claimFallbackWarning(key: string): boolean {
  if (warnedFallbacks.has(key)) return false;
  warnedFallbacks.add(key);
  return true;
}

/** @internal Also called by `_resetFontRegistryForTests`: dropping the fonts
 *  a warning was about has to drop the warning too. */
export function _clearFallbackWarnings(): void {
  warnedFallbacks.clear();
}

/** Test helper. Do not call from product code. */
export function _resetFallbackForTests(): void {
  policy = 'substitute';
  defaultFamily = null;
  warnedFallbacks.clear();
}
