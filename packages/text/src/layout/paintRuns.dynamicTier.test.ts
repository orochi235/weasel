import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerCanvasFont, resetBakeBudget } from '@weasel-js/font';
import {
  _resetFontRegistryForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — canvas-dynamic faces', () => {
  beforeEach(() => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: (_f, _w, _s, cp) =>
        cp === 32
          ? { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 12 }
          : { width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 },
    });
    registerCanvasFont('Dyn');
  });

  const dynRun = (text: string): ResolvedRun => ({
    text,
    fontFamily: 'Dyn',
    fontWeight: 400,
    fontStyle: 'normal',
    fontSize: 24, // scale = 24/48 = 0.5
    fill: { paint: { kind: 'solid', color: '#000' } },
    letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  });

  it('lays out a dynamic run into a canvas-source group with quads', () => {
    const laid = layoutAndPaint([dynRun('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(laid.groups.length).toBe(1);
    const g = laid.groups[0];
    expect(g.source).toBe('canvas');
    expect(g.page).toBe(0);
    expect(g.quads.length).toBe(2);
    // Advance 22 at scale 0.5 → second glyph starts 11 units right of the first.
    expect(laid.groups[0].quads[1].x0 - laid.groups[0].quads[0].x0).toBeCloseTo(11);
    expect(laid.bounds.width).toBeCloseTo(22);
  });

  it('unbaked glyphs advance the pen but emit no quads', () => {
    resetBakeBudget(0);
    const laid = layoutAndPaint([dynRun('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(laid.groups.flatMap((g) => g.quads).length).toBe(0);
    expect(laid.bounds.width).toBeCloseTo(22); // measureText advances still count
  });

  it('spaces contribute real measured advances without quads', () => {
    const laid = layoutAndPaint([dynRun('A B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(laid.groups.flatMap((g) => g.quads).length).toBe(2);
    // A(22) + space(12) + B(22) at scale 0.5.
    expect(laid.bounds.width).toBeCloseTo(28);
  });

  it('tracks dynamic glyphs too, including the blank ones that emit no quad', () => {
    const opts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
    const plain = layoutAndPaint([dynRun('A B')], opts);
    const tracked = layoutAndPaint([{ ...dynRun('A B'), letterSpacing: 5 }], opts);
    // A(11) + space(6) + B(11) at scale 0.5, plus 5 after each of 3 characters.
    expect(plain.bounds.width).toBeCloseTo(28);
    expect(tracked.bounds.width).toBeCloseTo(43);
    // The space emits no quad but must still carry its tracking, so 'B' moves
    // by two characters' worth — otherwise quads drift out of the line width.
    const bx = (o: ReturnType<typeof layoutAndPaint>) =>
      o.groups.flatMap((g) => g.quads.map((q) => q.x0))[1];
    expect(bx(tracked) - bx(plain)).toBeCloseTo(10);
  });

  it('reports no ink, and warns, for a code point a canvas face cannot rasterize', () => {
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: (_f, _w, _s, cp) => (cp === 0xe000
        ? { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 0 }
        : { width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255), left: -8, top: 26, advance: 22 }),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const laid = layoutAndPaint([dynRun('A\ue000B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(laid.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, false, true]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('U+E000');
    warn.mockRestore();
  });

  it('atlas groups still report source "atlas" and page 0', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const group = out.groups[0];
    expect(group.source).toBe('atlas');
    expect(group.page).toBe(0);
  });
});
