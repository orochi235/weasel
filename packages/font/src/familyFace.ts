import type { FontStyle } from './fontStyle';
import { variantKey } from './variantKey';
import { atlasResult, sharedExactResult } from './atlasResult';
import type { FontEntry, FontFamilyFaces } from './registerFont';
import type { ResolveResult } from './resolveResult';

function weightBucket(w: number): 'regular' | 'bold' {
  return w >= 600 ? 'bold' : 'regular';
}

/** The `style` face nearest `weight` in its bucket, ties going to the heavier. */
function nearestInBucket(
  faces: FontFamilyFaces, weight: number, style: FontStyle,
): { entry: FontEntry; weight: number } | null {
  const bucket = weightBucket(weight);
  let best: { entry: FontEntry; weight: number; distance: number } | null = null;
  for (const [key, entry] of faces) {
    const [wStr, s] = key.split('|') as [string, FontStyle];
    const w = Number(wStr);
    if (s !== style) continue;
    if (weightBucket(w) !== bucket) continue;
    const distance = Math.abs(w - weight);
    if (best === null || distance < best.distance || (distance === best.distance && w > best.weight)) {
      best = { entry, weight: w, distance };
    }
  }
  return best;
}

/**
 * The face one family's registered `faces` serve for `(weight, style)`, walking
 * the within-family chain, or null when none of them will do. `shared` returns
 * an exact match as the face's one frozen result.
 */
export function familyFaceFor(
  faces: FontFamilyFaces, family: string, weight: number, style: FontStyle, shared: boolean,
): ResolveResult | null {
  // 1. Exact match
  const exact = faces.get(variantKey(weight, style));
  if (exact) {
    return shared
      ? sharedExactResult(exact, family, weight, style)
      : atlasResult(exact, family, weight, style, false, false);
  }

  // 2. Same style, nearest weight in same bucket
  const sameStyle = nearestInBucket(faces, weight, style);
  if (sameStyle) return atlasResult(sameStyle.entry, family, sameStyle.weight, style, false, false);

  // 3. (family, 400, style)
  const sameStyleRegular = faces.get(variantKey(400, style));
  if (sameStyleRegular) return atlasResult(sameStyleRegular, family, 400, style, weight >= 600, false);

  // 4. (family, weight, 'normal') — same weight, no italic
  const sameWeightNormal = faces.get(variantKey(weight, 'normal'));
  if (sameWeightNormal) return atlasResult(sameWeightNormal, family, weight, 'normal', false, style === 'italic');

  // 4b. Nearest weight, normal style, same bucket
  const normal = nearestInBucket(faces, weight, 'normal');
  if (normal) return atlasResult(normal.entry, family, normal.weight, 'normal', false, style === 'italic');

  // 5. (family, 400, 'normal') — last resort within family
  const regular = faces.get(variantKey(400, 'normal'));
  if (regular) return atlasResult(regular, family, 400, 'normal', weight >= 600, style === 'italic');

  return null;
}
