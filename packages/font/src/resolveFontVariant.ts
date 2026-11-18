/**
 * Resolving a `(family, weight, style)` request to the face that draws it:
 * an atlas face, walking the within-family chain, then the canvas, outline and
 * substitute tiers past it.
 */

import { variantKey } from './variantKey';
import type { FontStyle } from './fontStyle';
import { isCanvasFont, isExplicitCanvasFont, autoEnrollCanvasFont, getDynamicFace } from './dynamic/dynamicAtlas';
import { getFontFallbackPolicy, getDefaultFontFamily } from './fallback';
import { outlineFace } from './outline/outlineRegistry';
import { familyFaceFor } from './familyFace';
import type { ResolveResult } from './resolveResult';
import {
  atlasPending, firstRegisteredFamily, fontRegistry, isFontPending, variantLoad, wakeDeclared,
} from './registerFont';
import {
  warnMissingFamilyOnce, warnSelfUnusableDefaultOnce, warnUnregisteredDefaultOnce, warnUnusableDefaultOnce,
} from './registerFontWarnings';

function missResolveResult(
  family: string, weight: number, style: FontStyle, suppressWarn = false,
): ResolveResult {
  // Canvas-dynamic tier. Dynamic faces rasterize the real weight/style — no
  // synthetic flags.
  //
  // Explicit enrollment only. A family the `'canvas'` policy enrolled for
  // itself must not keep routing here after the policy changes, or `'none'`
  // could never restore the hard miss it documents.
  if (isExplicitCanvasFont(family)) {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }

  // Outline-only: a family with parsed font bytes and no atlas. Ranked above
  // every fallback below because it is the *real* face, and below explicit
  // canvas enrollment, which is a consumer saying which tier it wants.
  const face = outlineFace(family, weight, style);
  if (face) {
    return {
      entry: null,
      outlineFace: face,
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'outline',
    };
  }
  // Its bytes are on their way, which outranks a stand-in as a pending atlas does.
  if (isFontPending(family, weight, style)) return pendingMiss(family, weight, style);

  const policy = getFontFallbackPolicy();

  if (policy === 'canvas') {
    // Auto-enroll: the browser probably has this family even though no atlas
    // was baked for it. Real typeface, canvas-SDF quality.
    autoEnrollCanvasFont(family);
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { family, weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }

  if (policy === 'substitute') {
    const fallback = getDefaultFontFamily() ?? firstRegisteredFamily();
    // Guard against recursing when the default family is itself unknown.
    // Canvas families never enter `registry`, so membership there alone would
    // reject `setDefaultFontFamily` pointed at one. `isCanvasFont` answers
    // "served by the dynamic tier right now": a family the `'canvas'` policy
    // auto-enrolled is not served under this policy.
    if (fallback !== null && fallback !== family) {
      if (fontRegistry.has(fallback) || isCanvasFont(fallback) || atlasPending(fallback)) {
        // A probe, not a top-level request: suppress, so this recursion can't
        // land in the `fallback === family` branch below and double-warn.
        const result = resolveFontVariantInternal(fallback, weight, style, true, false);
        // Renderable, not baked: a fallback served by the dynamic tier reports
        // `entry: null` with a dynamicFace.
        if (result.entry !== null || result.dynamicFace !== undefined) {
          if (!suppressWarn) warnMissingFamilyOnce(family, weight, style, fallback, fontRegistry.has(family));
          return { ...result, substituted: { requested: family, resolved: fallback } };
        }
        // Still loading: nothing to swap to yet, and nothing to warn about.
        if (atlasPending(fallback)) return pendingMiss(family, weight, style);
      }
      // Substitution was supposed to happen and produced nothing: text is
      // invisible, so say which of the two families to fix.
      if (!suppressWarn) {
        warnUnusableDefaultOnce(family, weight, style, fallback, fontRegistry.has(fallback) || isCanvasFont(fallback));
      }
    } else if (fallback === family && !suppressWarn) {
      // The family that can't serve this variant *is* the effective default.
      // Nothing renders and, without this branch, nothing is logged either.
      if (fontRegistry.has(family)) {
        warnSelfUnusableDefaultOnce(family, weight, style);
      } else {
        // Unregistered, yet still the effective default: it can only have been
        // named explicitly, because the implicit one is the first *registered*
        // family.
        warnUnregisteredDefaultOnce(family, weight, style);
      }
    }
  }

  return {
    entry: null,
    resolved: { family, weight, style },
    synthetic: { bold: false, italic: false },
    source: 'atlas',
  };
}

/** A miss that is only late: nothing substituted, nothing warned. */
function pendingMiss(family: string, weight: number, style: FontStyle): ResolveResult {
  return {
    entry: null,
    resolved: { family, weight, style },
    synthetic: { bold: false, italic: false },
    source: 'atlas',
  };
}

/**
 * Resolve a `(family, weight, style)` request to a registered font entry,
 * walking the fallback chain when an exact match isn't available. Returns
 * synthetic flags describing the gap between requested and resolved so the
 * renderer can apply SDF-thicken / vertex-skew fakes.
 */
export function resolveFontVariant(
  family: string,
  weight: number,
  style: FontStyle,
): ResolveResult {
  return resolveFontVariantInternal(family, weight, style, false, false);
}

/**
 * {@link resolveFontVariant} for a caller that only reads the result: an exact
 * match is one frozen object per face rather than a new one each call, so text
 * laid out every frame resolves its faces without allocating.
 */
export function cachedFontVariant(family: string, weight: number, style: FontStyle): Readonly<ResolveResult> {
  return resolveFontVariantInternal(family, weight, style, false, true);
}

/**
 * `suppressWarn` is set only by the recursive substitution probe in
 * `missResolveResult`, which resolves the fallback family purely to check
 * whether it renders. The probe must not emit — or claim the warn-once key
 * for — a message about a resolution the caller never made.
 */
function resolveFontVariantInternal(
  family: string,
  weight: number,
  style: FontStyle,
  suppressWarn: boolean,
  shared: boolean,
): ResolveResult {
  wakeDeclared(family, weight, style);
  // An atlas on its way outranks every stand-in: laying out in a fallback's
  // metrics now would reflow the text when the real face lands.
  // A landed variant is not on its way, even before its load promise settles:
  // `fetchVariant` wakes subscribers first, and they resolve synchronously.
  const exactKey = variantKey(weight, style);
  if (variantLoad(family, exactKey) !== undefined && !fontRegistry.get(family)?.has(exactKey)) {
    return pendingMiss(family, weight, style);
  }
  const familyMap = fontRegistry.get(family);
  if (!familyMap || familyMap.size === 0) {
    if (atlasPending(family)) return pendingMiss(family, weight, style);
    return missResolveResult(family, weight, style, suppressWarn);
  }

  return familyFaceFor(familyMap, family, weight, style, shared)
    ?? missResolveResult(family, weight, style, suppressWarn);
}
