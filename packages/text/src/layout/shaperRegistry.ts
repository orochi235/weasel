/**
 * Where the shaping engine arrives, the way the bidi engine does
 * (`bidiRegistry.ts`): registered once, found by every layout.
 */
import { bumpTextEngineGeneration } from './engineGeneration';
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
  if (registered !== shaper) bumpTextEngineGeneration();
  registered = shaper;
  return () => {
    if (registered !== shaper) return;
    registered = null;
    bumpTextEngineGeneration();
  };
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
    : outlineMetrics(family, weight, style));
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

/** Code point blocks whose letters join, reorder or stack, so a layout that
 *  sets each code point as its own glyph draws them wrong: Arabic, Syriac,
 *  Thaana, N'Ko, the Indic scripts, Tibetan, Myanmar, Khmer and Mongolian. */
const SHAPED_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x0600, 0x07ff], [0x0860, 0x08ff], [0x0900, 0x0dff], [0x0f00, 0x0fff],
  [0x1000, 0x109f], [0x1780, 0x18af], [0xa8e0, 0xa8ff], [0xfb50, 0xfdff], [0xfe70, 0xfefc],
];

/** Digits and punctuation in those blocks keep their form alone. */
const LETTER = /[\p{L}\p{M}]/u;

let warnedUnshaped = false;

/**
 * Warn, once per process, when `codePoints` hold letters of a script that
 * needs shaping and there is no shaper to shape them. `who` names the caller
 * laying them out.
 */
export function warnShapingWithoutEngine(codePoints: ArrayLike<number>, who = 'weasel layoutRuns'): void {
  if (warnedUnshaped) return;
  for (let i = 0; i < codePoints.length; i++) {
    const cp = codePoints[i];
    if (!SHAPED_BLOCKS.some(([lo, hi]) => cp >= lo && cp <= hi) || !LETTER.test(String.fromCodePoint(cp))) continue;
    warnedUnshaped = true;
    console.warn(
      `${who}: this text holds letters that join or reorder (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) ` +
      'but no shaper is registered, so each is set as its own glyph and the words will not join. ' +
      'Import `loadShaper` out of the `@weasel-js/text-shaping` package and call ' +
      '`registerShaper(await loadShaper())` once at startup; the face needs its font file ' +
      'registered with `registerFontOutlines` for the shaper to read.',
    );
    return;
  }
}

/** Test helper. Do not call from product code. */
export function _resetShapingWarningForTests(): void {
  warnedUnshaped = false;
}
