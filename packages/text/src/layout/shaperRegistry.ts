/**
 * Where the shaping engine arrives, the way the bidi engine does
 * (`bidiRegistry.ts`): registered once, found by every layout.
 */
import { resolveFontVariant, type FontStyle, type OutlineFace, type ResolveResult } from '@weasel-js/font';
import type { TextShaper } from './shaperSeam';

let registered: TextShaper | null = null;

/**
 * Give every text layout a shaping engine: `registerShaper(await
 * loadShaper())`, with `loadShaper` from `@weasel-js/shape`. `layoutRuns` uses
 * it whenever its options carry none. Pass `null`, or call the function
 * returned, to take it out again.
 *
 * Shaping reaches the text whose face was registered with
 * `registerFontOutlines` from TrueType or OpenType bytes: those are the faces
 * whose glyphs are drawn by index. Text drawn from a baked or canvas atlas,
 * whose glyphs are looked up by code point, is laid out as before.
 */
export function registerShaper(shaper: TextShaper | null): () => void {
  registered = shaper;
  return () => { if (registered === shaper) registered = null; };
}

/** The shaper {@link registerShaper} was last given, or null. */
export function registeredShaper(): TextShaper | null {
  return registered;
}

const bytesOf = new WeakMap<OutlineFace, ArrayBuffer | null>();

/** The font file behind the face `resolved` landed on, when it is an outline
 *  face with sfnt bytes a shaper can read; null otherwise. */
export function shapeableBytes(resolved: ResolveResult): ArrayBuffer | null {
  const face = resolved.outlineFace;
  if (!face) return null;
  let bytes = bytesOf.get(face);
  if (bytes === undefined) {
    bytes = face.embedding?.().sfnt ?? null;
    bytesOf.set(face, bytes);
  }
  return bytes;
}

/** Whether text set in `(family, weight, style)` will be shaped by `shaper`
 *  with OpenType feature `tag` available. */
export function shapesWithFeature(
  family: string, weight: number, style: FontStyle, tag: string, shaper: TextShaper | null = registered,
): boolean {
  if (shaper === null) return false;
  const bytes = shapeableBytes(resolveFontVariant(family, weight, style));
  return bytes !== null && shaper.hasFeature(bytes, tag);
}
