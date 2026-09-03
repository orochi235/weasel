import { bakeCursor } from './bake';
import type { BakeOptions } from './bake';
import { GLYPHS } from './glyphs';
import type { CursorGlyphName } from './glyphs';
import type { CursorGlyph } from './types';

const cache = new Map<string, string>();

/**
 * The baked cursor string for a named glyph, memoized.
 *
 * The key space is bounded by the glyph set times the handful of sizes and
 * fallbacks in use, so the cache needs no eviction.
 */
export function cursorFor(name: CursorGlyphName, opts: BakeOptions = {}): string {
  const size = opts.size ?? 24;
  const fallback = opts.fallback ?? 'default';
  const key = `${name}|${size}|${fallback}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  // Widened deliberately: the key type says this is always defined, but the
  // guard is what makes a bad name from untyped JS throw instead of baking
  // `undefined` into a cursor string that silently does nothing.
  const glyph = (GLYPHS as Record<string, CursorGlyph | undefined>)[name];
  if (glyph === undefined) {
    throw new Error(`unknown cursor glyph: ${String(name)}`);
  }
  const css = bakeCursor(glyph, { size, fallback });
  cache.set(key, css);
  return css;
}
