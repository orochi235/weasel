/**
 * Stateful test of the dynamic atlas: random glyph and cluster requests across families, frames with random bake
 * budgets, timer ticks, refreshes, and unregistrations, with glyphs big enough to fill the pages and force them
 * emptied. After every step each glyph a face still holds is checked: a baked one lies inside a page, overlaps no
 * other on its page, and its texels are still the ones it baked. The distance transform is replaced by a copy, so
 * texels name their glyph; `distanceTransform.pbt.test.ts` holds the real one to its definition.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { BmFontChar } from '../FontAtlas';
import { _resetFallbackForTests } from '../fallback';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import {
  MAX_PAGES, PAGE_SIZE, getDynamicFace, refreshCanvasFont, registerCanvasFont, resetBakeBudget,
  unregisterCanvasFont, _getPagesForTests, _resetDynamicFontsForTests, __setGlyphRasterizerForTests, type DynamicFace,
} from './dynamicAtlas';
import { _getColorPagesForTests } from './dynamicPages';
import type { GlyphRasterizer } from './glyphRasterizer';

vi.mock('./distanceTransform', () => ({ alphaToSdf: (alpha: Uint8ClampedArray) => Uint8Array.from(alpha) }));

const RUNS = 120;
const FAMILIES = ['Alpha', 'Beta', 'Gamma'] as const;
const BIG = 1000;

/** A glyph's size: small for most code points, most of a page wide for those from {@link BIG}. */
function sizeOf(cp: number): [number, number] {
  if (cp === 32) return [0, 0];
  if (cp >= BIG) return [PAGE_SIZE - 24 * (cp - BIG), 400 + 60 * (cp - BIG)];
  return [1 + ((cp * 37) % 40), 1 + ((cp * 53) % 40)];
}

/** Every texel of a glyph carries this value, so a texel shows whose it is. */
const ink = (cp: number, family: number): number => 1 + ((cp * 3 + family * 101) % 254);

function rasterizer(): GlyphRasterizer {
  return {
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: (family, _w, _s, cp) => {
      const [width, height] = sizeOf(cp);
      const alpha = new Uint8ClampedArray(width * height).fill(ink(cp, FAMILIES.indexOf(family as never)));
      return { width, height, alpha, left: -2, top: 30, advance: width };
    },
    rasterizeColor: (family, _w, _s, text) => {
      const cp = text.codePointAt(0)!;
      if (cp % 3 === 0) return null;
      const [width, height] = sizeOf(cp);
      const rgba = new Uint8ClampedArray(width * height * 4).fill(ink(cp, FAMILIES.indexOf(family as never)));
      return { width, height, rgba, left: -2, top: 30, advance: width };
    },
  };
}

interface Live { char: BmFontChar; cp: number; family: number; color: boolean }

/** The records each family's current face still holds. */
function live(faces: Map<number, DynamicFace>): Live[] {
  const out: Live[] = [];
  for (const [family, face] of faces) {
    for (const char of face.font.chars) out.push({ char, cp: char.id, family, color: false });
    const clusters = (face as unknown as { clusters: Map<string, BmFontChar | null> }).clusters;
    for (const [text, char] of clusters) if (char) out.push({ char, cp: text.codePointAt(0)!, family, color: true });
  }
  return out;
}

function check(faces: Map<number, DynamicFace>, t: ReturnType<typeof tally>): void {
  const all = live(faces);
  const fieldPages = _getPagesForTests();
  const colorPages = _getColorPagesForTests();
  for (const [i, g] of all.entries()) {
    const [w, h] = sizeOf(g.cp);
    const { char } = g;
    if (w === 0) { expect(char.page).toBe(0); continue; }
    if (char.page === -1) { expect(char.width).toBe(0); t.count('waiting'); continue; }
    t.count(g.color ? 'baked color' : 'baked');
    expect([char.width, char.height]).toEqual([w, h]);
    expect(char.page).toBeLessThan(MAX_PAGES);
    expect(char.x + w).toBeLessThanOrEqual(PAGE_SIZE);
    expect(char.y + h).toBeLessThanOrEqual(PAGE_SIZE);
    const page = (g.color ? colorPages : fieldPages)[char.page]!;
    const n = g.color ? 4 : 1;
    for (const [dx, dy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, h >> 1]] as const) {
      expect(page.data[((char.y + dy) * PAGE_SIZE + char.x + dx) * n], `texel of U+${g.cp} at ${dx},${dy}`).toBe(ink(g.cp, g.family));
    }
    for (const o of all.slice(i + 1)) {
      if (o.color !== g.color || o.char.page !== char.page || o.char.width === 0) continue;
      const c = o.char;
      const apart = char.x + char.width <= c.x || c.x + c.width <= char.x || char.y + char.height <= c.y || c.y + c.height <= char.y;
      expect(apart, `U+${g.cp} and U+${o.cp} overlap`).toBe(true);
    }
  }
}

type Cmd =
  | { kind: 'glyph' | 'cluster'; family: number; cp: number }
  | { kind: 'frame'; budget: number }
  | { kind: 'tick' }
  | { kind: 'refresh'; family: number | null }
  | { kind: 'unregister'; family: number };

const family = fc.integer({ min: 0, max: FAMILIES.length - 1 });
const cp = fc.oneof({ weight: 5, arbitrary: fc.integer({ min: 32, max: 90 }) }, { weight: 2, arbitrary: fc.integer({ min: BIG, max: BIG + 6 }) });
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 10, arbitrary: fc.record({ kind: fc.constant('glyph' as const), family, cp }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('cluster' as const), family, cp }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('frame' as const), budget: fc.constantFrom(0, 1, 4, 16, Infinity) }) },
  { weight: 3, arbitrary: fc.constant({ kind: 'tick' as const }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('refresh' as const), family: fc.option(family, { nil: null }) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('unregister' as const), family }) },
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  _resetDynamicFontsForTests();
});

describe('dynamic atlas, stateful', () => {
  it('keeps every glyph a face holds inside a page, apart from the rest, and on its own texels', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(cmd, { minLength: 30, maxLength: 100 }), (cmds) => {
      _resetDynamicFontsForTests();
      _resetFallbackForTests();
      __setGlyphRasterizerForTests(rasterizer());
      vi.clearAllTimers();
      const faces = new Map<number, DynamicFace>();
      const face = (f: number): DynamicFace => {
        registerCanvasFont(FAMILIES[f]!);
        const got = getDynamicFace(FAMILIES[f]!, 400, 'normal');
        faces.set(f, got);
        return got;
      };
      for (const c of cmds) {
        if (c.kind === 'glyph') face(c.family).requestGlyph(c.cp);
        else if (c.kind === 'cluster') face(c.family).requestCluster(String.fromCodePoint(c.cp));
        else if (c.kind === 'frame') resetBakeBudget(c.budget);
        else if (c.kind === 'tick') vi.runOnlyPendingTimers();
        else if (c.kind === 'refresh') refreshCanvasFont(c.family === null ? undefined : FAMILIES[c.family]);
        else { unregisterCanvasFont(FAMILIES[c.family]!); faces.delete(c.family); }
        check(faces, t);
      }
      if (_getPagesForTests().length === MAX_PAGES) t.count('every page opened');
    }), runs(RUNS));
    t.atLeast('baked', 1000);
    t.atLeast('baked color', 100);
    t.atLeast('waiting', 100);
    t.atLeast('every page opened', 5);
  }, timeoutFor(RUNS, 60));

  it('bakes every glyph a face holds once the frames and ticks run out, when they fit together', () => {
    const t = tally();
    const small = fc.integer({ min: 32, max: 90 });
    fc.assert(fc.property(fc.array(fc.tuple(family, small, fc.boolean()), { minLength: 1, maxLength: 60 }), fc.constantFrom(0, 1, 4, 16),
      (asks, budget) => {
        _resetDynamicFontsForTests();
        _resetFallbackForTests();
        __setGlyphRasterizerForTests(rasterizer());
        vi.clearAllTimers();
        const faces = new Map<number, DynamicFace>();
        resetBakeBudget(budget);
        for (const [f, c, color] of asks) {
          registerCanvasFont(FAMILIES[f]!);
          const got = getDynamicFace(FAMILIES[f]!, 400, 'normal');
          faces.set(f, got);
          if (color) got.requestCluster(String.fromCodePoint(c)); else got.requestGlyph(c);
        }
        vi.runAllTimers();
        for (const g of live(faces)) {
          expect(g.char.page, `U+${g.cp}`).not.toBe(-1);
          t.count('baked');
        }
        check(faces, t);
      }), runs(RUNS * 2));
    t.atLeast('baked', 1000);
  }, timeoutFor(RUNS * 2, 20));
});
