import type { FontStyle } from './fontStyle';

let last = { family: '', weight: NaN, style: '', key: '' };

/** The texture cache key used by `ensureFontTexture` for a given variant. */
export function textureCacheKey(family: string, weight: number, style: FontStyle): string {
  // Asked for every glyph group the renderer draws, every frame, and nearly
  // always for the same face as the last call.
  if (last.family === family && last.weight === weight && last.style === style) return last.key;
  last = { family, weight, style, key: `${family}|${weight}|${style}` };
  return last.key;
}
