/**
 * What is drawn for a layout, memoized apart from it: a recolor, a zoom across
 * the outline threshold and a dynamic bake landing each change the painting
 * and none of them lays the text out again.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerFont, FIXTURE_FONT, registerCanvasFont, registerFontOutlines, glyphOutline, resetBakeBudget,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetFallbackForTests, _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests, _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import { cachedLayoutRuns, _resetLayoutCacheForTests } from './layoutCache';
import { layoutRuns } from './layoutRuns';
import { cachedPaintRuns, PAINT_CACHE_VARIANT_LIMIT } from './paintCache';
import type { ResolvedRun } from '../runs/resolveRuns';

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetDynamicFontsForTests();
  _resetFontOutlinesForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
  registerFontOutlines('inter', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
    parser: () => ({
      unitsPerEm: 1000, ascender: 0.8, kernOf: () => 0, advanceOf: () => 0.6, glyphD: () => 'M0 0L1 0L1 -1Z',
    }),
  });
  glyphOutline('inter', 400, 'normal', 65);
  await new Promise<void>((r) => setTimeout(r, 0));
  _resetLayoutCacheForTests();
});

function run(text: string, fontSize = 16): ResolvedRun {
  return {
    text, fontFamily: 'inter', fontSize, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  };
}

const OPTS = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };

describe('cachedPaintRuns', () => {
  it('paints once for the same layout, runs and options', () => {
    const runs = [run('AB')];
    const laid = cachedLayoutRuns(runs, OPTS);
    expect(cachedPaintRuns(laid, runs)).toBe(cachedPaintRuns(laid, runs));
  });

  it('answers runs that paint the same from a fresh array', () => {
    const laid = cachedLayoutRuns([run('AB')], OPTS);
    expect(cachedPaintRuns(laid, [run('AB')])).toBe(cachedPaintRuns(laid, [run('AB')]));
  });

  it('paints again, on the same layout, when a fill, stroke or decoration changes', () => {
    const base = [run('AB')];
    const laid = cachedLayoutRuns(base, OPTS);
    const painted = cachedPaintRuns(laid, base);
    const variants: ResolvedRun[][] = [
      [{ ...run('AB'), fill: { paint: { kind: 'solid', color: '#f00' } } }],
      [{ ...run('AB'), fill: null }],
      [{ ...run('AB'), stroke: { paint: { color: '#f00' }, width: 2 } }],
      [{ ...run('AB'), underline: true }],
    ];
    for (const runs of variants) {
      expect(cachedLayoutRuns(runs, OPTS)).toBe(laid);
      expect(cachedPaintRuns(laid, runs)).not.toBe(painted);
    }
    expect(cachedPaintRuns(laid, variants[0]).groups[0].fill?.paint).toEqual({ kind: 'solid', color: '#f00' });
  });

  it('tells a second paint on a fresh layout from the first, whose key it builds late', () => {
    // The first painting on a layout builds no key; the second has to build
    // the first one's from the runs it was painted for, not its own.
    const red = [{ ...run('AB'), fill: { paint: { kind: 'solid' as const, color: '#f00' } } }];
    const laid = cachedLayoutRuns(red, OPTS);
    const first = cachedPaintRuns(laid, red);
    const blue = [{ ...run('AB'), fill: { paint: { kind: 'solid' as const, color: '#00f' } } }];
    expect(cachedPaintRuns(laid, blue)).not.toBe(first);
    expect(cachedPaintRuns(laid, blue).groups[0].fill?.paint).toEqual({ kind: 'solid', color: '#00f' });
    expect(cachedPaintRuns(laid, [{ ...red[0] }])).toBe(first);
  });

  it('keeps one runs array\'s painting per layout as it moves between two', () => {
    const runs = [run('AB CD')];
    const wide = cachedLayoutRuns(runs, OPTS);
    const narrow = cachedLayoutRuns(runs, { ...OPTS, maxWidth: 1 });
    expect(narrow).not.toBe(wide);
    const onWide = cachedPaintRuns(wide, runs);
    const onNarrow = cachedPaintRuns(narrow, runs);
    expect(onNarrow).not.toBe(onWide);
    expect(cachedPaintRuns(wide, runs)).toBe(onWide);
    expect(cachedPaintRuns(narrow, runs)).toBe(onNarrow);
  });

  it('paints runs the layout cache has not seen, which then lay out as fresh runs would', () => {
    const runs = [run('AB')];
    const laid = layoutRuns(runs, OPTS);
    const painted = cachedPaintRuns(laid, runs);
    expect(cachedPaintRuns(laid, runs)).toBe(painted);
    expect(cachedLayoutRuns(runs, OPTS).lines[0].cells).toEqual(laid.lines[0].cells);
  });

  describe('the outline threshold', () => {
    // `outlineMinSize` is derived from the view zoom, so a naive key would
    // miss on every frame of a pinch.
    it('holds across a zoom change that crosses no run size', () => {
      const runs = [run('AB', 16)];
      const laid = cachedLayoutRuns(runs, OPTS);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 30 }))
        .toBe(cachedPaintRuns(laid, runs, { outlineMinSize: 40 }));
    });

    it('paints again when the threshold crosses a run size', () => {
      const runs = [run('AB', 16)];
      const laid = cachedLayoutRuns(runs, OPTS);
      const below = cachedPaintRuns(laid, runs, { outlineMinSize: 20 });
      const above = cachedPaintRuns(laid, runs, { outlineMinSize: 12 });
      expect(below.groups.map((g) => g.source)).toEqual(['atlas']);
      expect(above.groups.map((g) => g.source)).toEqual(['outline']);
    });

    it('paints for the threshold asked, back and forth across a run size', () => {
      // A repeated threshold is a hit with no key built, so the threshold
      // moving back has to be told apart from it.
      const runs = [run('AB', 16)];
      const laid = cachedLayoutRuns(runs, OPTS);
      const below = cachedPaintRuns(laid, runs, { outlineMinSize: 20 });
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 20 })).toBe(below);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 12 }).groups.map((g) => g.source)).toEqual(['outline']);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 20 })).toBe(below);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 25 })).toBe(below);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 12 }).groups.map((g) => g.source)).toEqual(['outline']);
    });

    it('distinguishes "no threshold" from a threshold above every run', () => {
      // They differ for a stroked run, which only a threshold moves to outlines.
      const runs = [{ ...run('AB', 16), stroke: { paint: { color: '#f00' }, width: 1 } }];
      const laid = cachedLayoutRuns(runs, OPTS);
      expect(cachedPaintRuns(laid, runs).groups.map((g) => g.source)).toEqual(['atlas']);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 999 }).groups.map((g) => g.source)).toEqual(['outline']);
    });

    it('tracks each distinct size in a mixed-size run list', () => {
      const runs = [run('A', 10), run('B', 40)];
      const laid = cachedLayoutRuns(runs, OPTS);
      const none = cachedPaintRuns(laid, runs, { outlineMinSize: 50 });
      const justBig = cachedPaintRuns(laid, runs, { outlineMinSize: 20 });
      const both = cachedPaintRuns(laid, runs, { outlineMinSize: 5 });
      expect(justBig).not.toBe(none);
      expect(both).not.toBe(justBig);
      expect(cachedPaintRuns(laid, runs, { outlineMinSize: 20 })).toBe(justBig);
    });
  });

  describe('labels that share a layout and differ in paint', () => {
    const label = (i: number): ResolvedRun[] => [{
      ...run('AB'),
      fill: { paint: { kind: 'solid', color: `hsl(${i * 7} 50% 50%)` } },
      underline: i % 3 === 0,
      ...(i % 5 === 0 ? { stroke: { paint: { color: '#f00' }, width: 1 + i } } : {}),
    }];
    const frame = (labels: readonly ResolvedRun[][]) =>
      labels.map((runs) => cachedPaintRuns(cachedLayoutRuns(runs, OPTS), runs));

    it('paints each once, however many there are, while their runs arrays live', () => {
      const labels = Array.from({ length: PAINT_CACHE_VARIANT_LIMIT * 4 }, (_, i) => label(i));
      expect(new Set(labels.map((runs) => cachedLayoutRuns(runs, OPTS))).size).toBe(1);
      const first = frame(labels);
      expect(new Set(first).size).toBe(labels.length);
      frame(labels).forEach((painted, i) => expect(painted).toBe(first[i]));
    });

    it('paints each once from runs built fresh every frame, for a palette of paints', () => {
      const first = frame(Array.from({ length: 24 }, (_, i) => label(i)));
      frame(Array.from({ length: 24 }, (_, i) => label(i))).forEach((painted, i) => expect(painted).toBe(first[i]));
    });
  });

  it('bounds the paintings held for one layout', () => {
    const laid = cachedLayoutRuns([run('AB')], OPTS);
    const colored = (i: number): ResolvedRun[] =>
      [{ ...run('AB'), fill: { paint: { kind: 'solid', color: `#00${i}` } } }];
    const first = cachedPaintRuns(laid, colored(0));
    for (let i = 1; i <= PAINT_CACHE_VARIANT_LIMIT; i++) cachedPaintRuns(laid, colored(i));
    expect(cachedPaintRuns(laid, colored(0))).not.toBe(first);
  });

  it('paints again when a deferred bake lands, on the layout it already had', async () => {
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22,
      }),
    });
    registerCanvasFont('Dyn');
    _resetLayoutCacheForTests();
    resetBakeBudget(0);
    const runs = [{ ...run('AB'), fontFamily: 'Dyn' }];
    const laid = cachedLayoutRuns(runs, OPTS);
    const waiting = cachedPaintRuns(laid, runs);
    expect(waiting.groups).toEqual([]);

    await new Promise<void>((r) => setTimeout(r, 0));

    expect(cachedLayoutRuns(runs, OPTS)).toBe(laid);
    const baked = cachedPaintRuns(laid, runs);
    expect(baked).not.toBe(waiting);
    expect(baked.groups.map((g) => [g.source, g.quads.length])).toEqual([['canvas', 2]]);
  });
});
