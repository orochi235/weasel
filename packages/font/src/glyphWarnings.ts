/**
 * Warnings about what the registered fonts cannot serve. Text is laid out per
 * frame, so each is claimed once through the fallback warning gate, which the
 * registry and fallback resets both clear.
 */
import { claimFallbackWarning } from './fallback';

/** Say, once per family and code point, that no tier has a glyph for it. */
export function warnMissingGlyph(family: string, cp: number): void {
  if (!claimFallbackWarning(`missing-glyph|${family}|${cp}`)) return;
  const ch = String.fromCodePoint(cp);
  console.warn(
    `weasel: no glyph for U+${cp.toString(16).toUpperCase().padStart(4, '0')} ` +
    `(${JSON.stringify(ch)}) in "${family}", and the dynamic tier could not ` +
    `rasterize it — skipping the character. Bake it into the atlas, or call ` +
    `registerCanvasFont("${family}") to serve missing codepoints from ` +
    `installed fonts.`,
  );
}
