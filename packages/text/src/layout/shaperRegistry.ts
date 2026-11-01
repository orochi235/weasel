/**
 * Where the shaping engine arrives, the way the bidi engine does
 * (`bidiRegistry.ts`): registered once, found by every layout.
 */
import {
  cachedFontVariant, outlineMetrics, type FaceEmbedding, type FontStyle, type OutlineFace, type ResolveResult,
} from '@weasel-js/font';
import type { TextShaper } from './shaperSeam';

let registered: TextShaper | null = null;

/**
 * Give every text layout a shaping engine: `registerShaper(await
 * loadShaper())`, with `loadShaper` from `@weasel-js/text-shaping`. `layoutRuns` uses
 * it whenever its options carry none. Pass `null`, or call the function
 * returned, to take it out again.
 *
 * Shaping reaches the text whose face has TrueType or OpenType bytes behind
 * it: a face registered with `registerFontOutlines` alone, or a baked or
 * canvas atlas face whose exact variant is also registered there. The atlas
 * must be cut from that same file, or its advances disagree with the
 * shaper's. On an atlas face, a cluster the shaping left as its code point's
 * own glyph draws from the atlas as before; the rest draw from the shaper's
 * glyphs.
 */
export function registerShaper(shaper: TextShaper | null): () => void {
  registered = shaper;
  return () => { if (registered === shaper) registered = null; };
}

/** The shaper {@link registerShaper} was last given, or null. */
export function registeredShaper(): TextShaper | null {
  return registered;
}

const embeddingOf = new WeakMap<OutlineFace, FaceEmbedding | null>();

/**
 * The face a shaper reads for text that resolved to `resolved`: its own on the
 * outline tier; on an atlas or canvas face, the outline face registered for
 * the same exact variant, which starts loading the first time it is asked
 * for. Null when there is none, or none with sfnt bytes.
 */
export function shapingFace(resolved: ResolveResult): FaceEmbedding | null {
  const { family, weight, style } = resolved.resolved;
  const face = resolved.outlineFace ?? (resolved.source === 'outline'
    ? undefined
    : outlineMetrics(family, weight, style === 'italic' ? 'italic' : 'normal'));
  if (!face) return null;
  let embedding = embeddingOf.get(face);
  if (embedding === undefined) {
    embedding = face.embedding?.() ?? null;
    embeddingOf.set(face, embedding);
  }
  return embedding;
}

/** The font file a shaper reads for text that resolved to `resolved` ({@link shapingFace}). */
export function shapeableBytes(resolved: ResolveResult): ArrayBuffer | null {
  return shapingFace(resolved)?.sfnt ?? null;
}

/** Whether text set in `(family, weight, style)` will be shaped by `shaper`
 *  with OpenType feature `tag` available. */
export function shapesWithFeature(
  family: string, weight: number, style: FontStyle, tag: string, shaper: TextShaper | null = registered,
): boolean {
  if (shaper === null) return false;
  const bytes = shapeableBytes(cachedFontVariant(family, weight, style));
  return bytes !== null && shaper.hasFeature(bytes, tag);
}
