/**
 * Which paints SVG draws with its own elements, and which only through
 * weasel's namespace with a fallback.
 */
import { isTileKind } from '@weasel-js/paint';

/** Whether SVG has its own paint server for paint kind `kind`: solids, the
 *  linear and radial gradients, and patterns. Any other kind is written in
 *  weasel's namespace with a fallback color, which other renderers paint flat. */
export function nativeSvgKind(kind: string): boolean {
  return kind === 'solid' || kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'texture' || kind === 'image' || isTileKind(kind);
}

/** Whether a gradient interpolating through `space` blends the same in every
 *  SVG renderer — only sRGB, the default. A perceptual space still exports,
 *  but renderers other than weasel blend it in sRGB. */
export function nativeSvgSpace(space: string | null | undefined): boolean {
  return !space || space === 'rgb';
}
