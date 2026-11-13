import { bakeCursor, bakeSize, quantizeCursorAngle } from './bake';
import type { BakeOptions } from './bake';
import { GLYPHS, MARKS } from './glyphs';
import type { CursorGlyphName, CursorMarkName } from './glyphs';
import { markedGlyph } from './mark';
import type { CursorGlyph, CursorMark } from './types';

const cache = new Map<string, string>();
const composed = new Map<string, CursorGlyph>();

/** What {@link cursorGlyph} sets in a glyph. */
export interface CursorGlyphOptions {
  /** A mark set in the glyph's slot: what the tool does, as `mark: 'rect'` on a crosshair. */
  readonly mark?: CursorMarkName;
}

/**
 * A named glyph, carrying a named mark in its slot when `mark` is given, memoized. Throws for a name the set lacks,
 * and for a mark on a glyph with no slot.
 */
export function cursorGlyph(name: CursorGlyphName, opts: CursorGlyphOptions = {}): CursorGlyph {
  const { mark } = opts;
  // Widened deliberately: the key types say these are always defined, but the
  // guard is what makes a bad name from untyped JS throw instead of baking
  // `undefined` into a cursor string that silently does nothing.
  const glyph = Object.hasOwn(GLYPHS, name) ? (GLYPHS as Record<string, CursorGlyph>)[name] : undefined;
  if (glyph === undefined) throw new Error(`unknown cursor glyph: ${String(name)}`);
  if (mark === undefined) return glyph;
  const key = `${name}+${mark}`;
  const hit = composed.get(key);
  if (hit) return hit;
  const m = Object.hasOwn(MARKS, mark) ? (MARKS as Record<string, CursorMark>)[mark] : undefined;
  if (m === undefined) throw new Error(`unknown cursor mark: ${String(mark)}`);
  if (!glyph.mark) throw new Error(`cursor glyph ${name} has no slot for a mark`);
  const out = markedGlyph(glyph, m);
  composed.set(key, out);
  return out;
}

/** One cursor a tool can ask for: a glyph, and the mark it carries if any. `key` names it as `glyph+mark`. */
export interface CursorVariant {
  readonly key: string;
  readonly glyph: CursorGlyphName;
  readonly mark?: CursorMarkName;
}

/** Every cursor a tool can ask for: each glyph alone, then each glyph that has a slot with each mark. */
export function cursorVariants(): readonly CursorVariant[] {
  const names = Object.keys(GLYPHS) as CursorGlyphName[];
  const marks = Object.keys(MARKS) as CursorMarkName[];
  return [
    ...names.map((glyph) => ({ key: glyph, glyph })),
    ...names
      .filter((glyph) => (GLYPHS[glyph] as CursorGlyph).mark !== undefined)
      .flatMap((glyph) => marks.map((mark) => ({ key: `${glyph}+${mark}`, glyph, mark }))),
  ];
}

/** What {@link cursorFor} bakes: {@link BakeOptions}, and the mark the glyph carries. */
export type CursorForOptions = BakeOptions & CursorGlyphOptions;

/**
 * The baked cursor string for a named glyph, memoized.
 *
 * The key space is bounded by the glyph set times its marks times 16 angles times the handful of sizes and
 * fallbacks in use, so the cache needs no eviction.
 */
export function cursorFor(name: CursorGlyphName, opts: CursorForOptions = {}): string {
  const size = bakeSize(opts.size);
  const fallback = opts.fallback ?? 'default';
  // The step index, not the raw angle: the hover pump feeds a continuously
  // varying selection rotation, so a raw-angle key would never hit.
  const step = quantizeCursorAngle(opts.angle ?? 0);
  const key = `${name}${opts.mark === undefined ? '' : `+${opts.mark}`}|${size}|${step}|${fallback}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const css = bakeCursor(cursorGlyph(name, { mark: opts.mark }), { size, fallback, angle: opts.angle ?? 0 });
  cache.set(key, css);
  return css;
}
