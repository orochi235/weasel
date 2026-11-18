/** The registered fonts as a font picker sees them: families, variants, weights. */

import type { FontStyle } from './fontStyle';
import { listFontOutlines } from './outline/outlineRegistry';
import { registeredFamilyNames, variantKeysOf } from './registerFont';

/** One family in the registry and the variants registered for it — what a
 *  font picker can honestly offer. */
export interface RegisteredFont {
  family: string;
  variants: readonly { weight: number; style: FontStyle }[];
}

/**
 * Enumerate the registry. Families come back in registration order; variants
 * sorted by weight, then style.
 */
export function listAtlasFonts(): readonly RegisteredFont[] {
  const out: RegisteredFont[] = [];
  for (const family of registeredFamilyNames()) {
    const keys = variantKeysOf(family);
    if (keys.size === 0) continue;
    const variants = [...keys]
      .map((key) => {
        const [w, s] = key.split('|') as [string, FontStyle];
        return { weight: Number(w), style: s };
      })
      .sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
    out.push({ family, variants });
  }
  return out;
}

/**
 * The weights `family` has a real face for, on the atlas tier or the outline
 * tier, in either style. Ascending and deduplicated; empty for a family
 * nothing registered. An outline face whose load failed is left out. The
 * canvas tier is not consulted: it rasterizes whatever weight it is asked for.
 */
export function listFontWeights(family: string): readonly number[] {
  const weights = new Set<number>();
  for (const key of variantKeysOf(family)) weights.add(Number(key.split('|')[0]));
  for (const face of listFontOutlines()) {
    if (face.family === family && face.status !== 'failed') weights.add(face.weight);
  }
  return [...weights].sort((a, b) => a - b);
}
