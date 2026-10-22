/**
 * Whether a derivation read glyph outlines. Outlines land asynchronously, so a
 * derivation that read them while a face was loading is stale once it lands,
 * with nothing in the scene changed. A derivation that noted a read records
 * {@link fontGeneration} and re-derives when it moves.
 */
import { glyphGeneration } from '@weasel-js/font';

let noted = false;

/** Note that the derivation running now read glyph outlines. */
export function noteFontRead(): void {
  noted = true;
}

/** Run `fn`, reporting whether it — or anything it ran — noted a font read.
 *  A read inside counts toward any enclosing `withFontReads` too. */
export function withFontReads<T>(fn: () => T): { value: T; fonts: boolean } {
  const outer = noted;
  noted = false;
  try {
    const value = fn();
    return { value, fonts: noted };
  } finally {
    noted = outer || noted;
  }
}

/** The glyph generation a font-reading derivation is checked against. */
export function fontGeneration(): number {
  return glyphGeneration();
}
