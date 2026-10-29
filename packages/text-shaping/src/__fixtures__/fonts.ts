/**
 * Subsets of Noto Sans (SIL Open Font License, `OFL.txt`), cut down with
 * `pyftsubset --layout-features='*' --no-hinting` to the characters the tests
 * shape:
 *
 * - Arabic: space, alef, beh, teh marbuta, teh, seen, lam, meem, yeh, fatha
 *   (U+0020, U+0627–U+062A, U+0633, U+0644, U+0645, U+064A, U+064E).
 * - Devanagari: space, ka, ta, ra, ssa, the i-matra and the virama
 *   (U+0020, U+0915, U+0924, U+0930, U+0937, U+093F, U+094D).
 * - Latin: space, `ABC`, `abc` (U+0020, U+0041–U+0043, U+0061–U+0063), with `smcp`.
 */
import { readFileSync } from 'node:fs';

function load(name: string): ArrayBuffer {
  // Copied into this realm's ArrayBuffer: a test runs in its own, and the font
  // registry tells bytes from a URL with `instanceof ArrayBuffer`.
  const bytes = readFileSync(new URL(name, import.meta.url));
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

export const ARABIC = load('./noto-sans-arabic-subset.ttf');
export const DEVANAGARI = load('./noto-sans-devanagari-subset.ttf');
export const LATIN = load('./noto-sans-latin-subset.ttf');
