/**
 * The warnings the atlas registry gives, once each, when the fallback chain lands on no face or on another family's.
 */

import type { FontStyle } from './fontStyle';
import { claimFallbackWarning, getDefaultFontFamily } from './fallback';

// Resolution runs per frame, so an unguarded warn would flood the console.
// The claimed keys live in fallback.ts so both reset seams clear them.
export function warnMissingFamilyOnce(
  family: string, weight: number, style: FontStyle, resolved: string, registered: boolean,
): void {
  if (!claimFallbackWarning(`substituted|${family}|${weight}|${style}`)) return;
  const cause = registered
    ? `has no variant matching ${weight}/${style}, and none of its registered ` +
      `variants are close enough for the within-family chain to substitute — ` +
      `rendering with "${resolved}" instead. Bake that variant with ` +
      `registerFont("${family}", { weight: ${weight}, style: '${style}' }, …)`
    : `is not registered — rendering with "${resolved}" instead. ` +
      `Call registerFont("${family}", …)`;
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) ${cause}. ` +
    `Advance widths will differ from the requested font. Use ` +
    `setFontFallbackPolicy('none') to make this a hard miss instead.`,
  );
}

/**
 * The substitute policy engaged and still came up empty: nothing renders, and
 * the fix is almost always in the fallback family rather than the requested one.
 */
export function warnUnusableDefaultOnce(
  family: string, weight: number, style: FontStyle, fallback: string, fallbackServed: boolean,
): void {
  if (!claimFallbackWarning(`unusable-default|${family}|${weight}|${style}`)) return;
  const origin = getDefaultFontFamily() === fallback
    ? 'set via setDefaultFontFamily'
    : 'the first registered family, since setDefaultFontFamily was never called';
  // A fallback the `'canvas'` policy auto-enrolled has nothing serving it
  // under this policy, so it counts as not registered.
  const gap = fallbackServed
    ? `has no variant that can serve ${weight}/${style}`
    : 'is not registered either';
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) is not available, and ` +
    `the fallback family "${fallback}" (${origin}) ${gap} — this text will not ` +
    `render at all. Bake that variant with registerFont("${fallback}", ` +
    `{ weight: ${weight}, style: '${style}' }, …), or point ` +
    `setDefaultFontFamily() at a family that covers it.`,
  );
}

/**
 * The requested family is registered and is also the effective default, so
 * there is nowhere left to fall back to.
 */
export function warnSelfUnusableDefaultOnce(
  family: string, weight: number, style: FontStyle,
): void {
  if (!claimFallbackWarning(`self-unusable-default|${family}|${weight}|${style}`)) return;
  const origin = getDefaultFontFamily() === family
    ? 'set via setDefaultFontFamily'
    : 'the first registered family, since setDefaultFontFamily was never called';
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) has no variant that can ` +
    `serve this request, and "${family}" is also the fallback family (${origin}) — ` +
    `there is nothing left to fall back to, so this text will not render at all. ` +
    `Bake that variant with registerFont("${family}", { weight: ${weight}, ` +
    `style: '${style}' }, …), or point setDefaultFontFamily() at a different family.`,
  );
}

/**
 * The requested family is the explicitly set default, and that default names
 * a family that was never registered at all.
 */
export function warnUnregisteredDefaultOnce(
  family: string, weight: number, style: FontStyle,
): void {
  if (!claimFallbackWarning(`unregistered-default|${family}|${weight}|${style}`)) return;
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) was never registered, and ` +
    `it is also the fallback family — setDefaultFontFamily("${family}") names a ` +
    `family with no registered variants at all, so there is nothing left to fall ` +
    `back to and this text will not render at all. Call registerFont("${family}", ` +
    `{ weight: ${weight}, style: '${style}' }, …), or point setDefaultFontFamily() ` +
    `at a family you have registered.`,
  );
}
