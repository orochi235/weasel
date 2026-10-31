// @vitest-environment node
/**
 * Shaping on a canvas atlas face: the family's font file registered with `registerFontOutlines`
 * beside `registerCanvasFont`, shaped by HarfBuzz, and drawn from baked tiles or outlines.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loadFontOutlines, registerCanvasFont, registerFontOutlines, resetBakeBudget, type FontStyle,
} from '@weasel-js/font';
import {
  _resetDynamicFontsForTests, _resetFontOutlinesForTests, _resetFontRegistryForTests, __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { layoutRuns, paintRuns, registerShaper, type PaintRunsOpts, type ResolvedRun } from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { loadShaper, type Shaper } from './index';
import { DEVANAGARI } from './__fixtures__/fonts';

const FAMILY = 'deva-canvas';
const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' } as const;

const run = (text: string): ResolvedRun => ({
  text, fontFamily: FAMILY, fontWeight: 400, fontStyle: 'normal' as FontStyle, fontSize: 24,
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});

function layoutAndPaint(runs: ResolvedRun[], opts: typeof OPTS & PaintRunsOpts) {
  const { outlineMinSize, ...layout } = opts;
  const laid = layoutRuns(runs, layout);
  return { ...laid, ...paintRuns(laid, runs, { outlineMinSize }) };
}

const box = (width: number, height: number) =>
  ({ width, height, alpha: new Uint8ClampedArray(width * height).fill(255), left: -8, top: 30 });

/** Every path the canvas tier was asked to fill. */
let filled: string[] = [];
let shaper: Shaper;
let unregister: () => void;

beforeAll(async () => {
  shaper = await loadShaper();
  unregister = registerShaper(shaper);
  // Node has no Path2D; the fake rasterizer below never constructs one.
  (globalThis as { Path2D?: unknown }).Path2D ??= class {};
});
afterAll(() => unregister());

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetDynamicFontsForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  filled = [];
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: () => ({ ...box(20, 24), advance: 22 }),
    rasterizePath: (d) => {
      filled.push(d);
      return { ...box(40, 30), advance: 0 };
    },
  });
  registerCanvasFont(FAMILY);
  registerFontOutlines(FAMILY, {}, DEVANAGARI);
  await loadFontOutlines(FAMILY, {});
});

describe('a canvas face whose font file is registered', () => {
  it('draws a shaped cluster as one baked tile, and a lone letter from its own glyph', () => {
    const laid = layoutAndPaint([run('किक')], OPTS);
    const [glyphs] = laid.lines.map((l) => l.glyphs);
    // कि is one cluster, the i-matra drawn before the ka; the lone क is its own glyph, unshaped.
    expect(glyphs[0].shaped?.glyphs.map((g) => g.gid)).toEqual(shaper.shape(DEVANAGARI, 'कि').map((g) => g.gid));
    expect(glyphs[2].shaped ?? null).toBeNull();
    expect(laid.groups.map((g) => g.source)).toEqual(['canvas']);
    expect(laid.groups[0].glyphs).toEqual([]);
    expect(laid.groups[0].quads).toHaveLength(2);
    // The tile is the cluster's outline, filled whole.
    expect(filled).toEqual([glyphs[0].shaped!.d]);
    // 40 bake px at 24/48 is the tile's 20 world units.
    expect(laid.groups[0].quads[0].x1 - laid.groups[0].quads[0].x0).toBeCloseTo(20);
  });

  it('draws a cluster from its outline until its tile has baked', () => {
    resetBakeBudget(0);
    const laid = layoutAndPaint([run('किक')], OPTS);
    const outline = laid.groups.find((g) => g.source === 'outline')!;
    expect(outline.glyphs).toHaveLength(1);
    expect(outline.glyphs[0].key).toContain('#');
    expect(outline.glyphs[0].d).toBe(laid.lines[0].glyphs[0].shaped!.d);
  });

  it('draws a cluster from its outline at or above the outline size', () => {
    const laid = layoutAndPaint([run('किक')], { ...OPTS, outlineMinSize: 20 });
    expect(laid.groups.every((g) => g.source === 'outline')).toBe(true);
    expect(filled).toEqual([]);
  });

  it('shapes nothing on a canvas face with no font file registered', () => {
    _resetFontOutlinesForTests();
    _resetLayoutCacheForTests();
    const laid = layoutAndPaint([run('किक')], OPTS);
    expect(laid.lines[0].glyphs.every((g) => !g.shaped)).toBe(true);
  });
});
