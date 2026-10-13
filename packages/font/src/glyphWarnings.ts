/**
 * Warnings about what the registered fonts cannot serve. Text is laid out per
 * frame, so each is claimed once through the fallback warning gate, which the
 * registry and fallback resets both clear.
 */
import { claimFallbackWarning, fallbackWarningClaimed } from './fallback';
import type { FontStyle } from './fontStyle';
import { fontPending } from './registerFont';

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

/** The registry's own warnings that a face will draw nothing, by key prefix. */
const NOTHING_RENDERS = ['unusable-default', 'self-unusable-default', 'unregistered-default'];

/**
 * Say, once per face, that text set in it has no metrics and lays out as
 * nothing. Silent while the face is still loading, which is late rather than
 * missing, and when the registry has already said why it cannot render.
 */
export function warnNoMetrics(family: string, weight: number, style: FontStyle): void {
  if (fontPending(family, weight, style)) return;
  const face = `${family}|${weight}|${style}`;
  if (NOTHING_RENDERS.some((kind) => fallbackWarningClaimed(`${kind}|${face}`))) return;
  if (!claimFallbackWarning(`no-metrics|${face}`)) return;
  console.warn(
    `weasel: no metrics for "${family}" ${weight}/${style} — neither ` +
    `an atlas nor an outline face resolved, so every run set in it lays out as ` +
    `nothing. Register it with registerFont / registerCanvasFont / ` +
    `registerFontOutlines. If you did, check for a duplicated @weasel-js/font in ` +
    `node_modules — its registry is module state, so a second copy is a second, ` +
    `empty one.`,
  );
}
