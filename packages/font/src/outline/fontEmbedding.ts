import type { FontStyle } from '../fontStyle';
import type { FaceEmbedding } from './OutlineFace';
import { loadFontOutlines, outlineMetrics } from './outlineRegistry';

/**
 * The embeddable sfnt and glyph map of a registered outline face, once its
 * bytes have loaded. `null` when nothing is registered for the variant, the
 * load failed, or the face's parser has no sfnt behind it.
 */
export async function fontEmbedding(
  family: string, weight: number, style: FontStyle,
): Promise<FaceEmbedding | null> {
  if ((await loadFontOutlines(family, { weight, style })) !== 'ready') return null;
  return outlineMetrics(family, weight, style)?.embedding?.() ?? null;
}
