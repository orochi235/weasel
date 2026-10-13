import { describe, it, expect, beforeEach } from 'vitest';
import { resetBakeBudget } from '@weasel-js/font';
import {
  _resetFontRegistryForTests,
  _resetFallbackForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };
const FAMILY = '👨‍👩‍👧';
const TONED = '👍🏽';
const FLAG = '🇨🇦';
/** The fixture atlas bakes at 32, the canvas tier at 48: a run set at 32 draws a canvas glyph at two thirds. */
const CANVAS_SCALE = 32 / 48;

/** A code point is a 20-wide box advancing 22; a cluster starting with an emoji is a 60-wide color glyph advancing 48. */
function stubRasterizer(color: (text: string) => boolean = () => true): string[] {
  const asked: string[] = [];
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: () => ({
      width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
      left: -8, top: 26, advance: 22,
    }),
    rasterizeColor: (_family, _weight, _style, text) => {
      asked.push(text);
      if (!color(text)) return null;
      return { width: 60, height: 60, rgba: new Uint8ClampedArray(60 * 60 * 4).fill(255), left: -6, top: 50, advance: 48 };
    },
  });
  return asked;
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetDynamicFontsForTests();
  _resetFallbackForTests();
  resetBakeBudget();
  stubFetch();
  await registerFixture('inter', [{}]);
});

describe('layoutRuns — a cluster with emoji presentation', () => {
  it.each([
    ['a joined family', FAMILY],
    ['a thumb and its skin tone', TONED],
    ['a flag', FLAG],
  ])('lays %s out as one glyph', (_name, emoji) => {
    stubRasterizer();
    const out = layoutAndPaint([RUN_PLAIN(`A${emoji}B`)], OPTS);
    const cells = out.lines[0].cells;
    const cluster = cells.slice(1, -1);
    expect(cluster.length).toBeGreaterThan(1);

    const closing = cluster[cluster.length - 1];
    expect(closing).toMatchObject({ clusterEnd: true, drawsInk: true });
    expect(closing.advance).toBeCloseTo(48 * CANVAS_SCALE);
    for (const cell of cluster.slice(0, -1)) {
      expect(cell).toMatchObject({ advance: 0, drawsInk: false, clusterEnd: false, x: closing.x });
    }
    const b = cells[cells.length - 1];
    expect(b.x).toBeCloseTo(closing.x + 48 * CANVAS_SCALE);
  });

  it('asks for the whole cluster, once, and never for a cluster of text', () => {
    const asked = stubRasterizer();
    layoutAndPaint([RUN_PLAIN(`A${FAMILY}B`)], OPTS);
    expect(asked).toEqual([FAMILY]);
  });

  it('draws it from a color group of its own, apart from the text around it', () => {
    stubRasterizer();
    const out = layoutAndPaint([RUN_PLAIN(`A${TONED}B`)], OPTS);
    expect(out.groups.map((g) => [g.source, g.quads.length])).toEqual([['atlas', 2], ['color', 1]]);
    const [quad] = out.groups[1].quads;
    expect(quad.x1 - quad.x0).toBeCloseTo(60 * CANVAS_SCALE);
    expect(quad.u1 - quad.u0).toBeCloseTo(60 / 1024);
  });

  it('keeps a color glyph a quad at a size where its run is drawn as outlines', () => {
    stubRasterizer();
    const out = layoutAndPaint([RUN_PLAIN(TONED)], { ...OPTS, outlineMinSize: 1 });
    expect(out.groups.map((g) => [g.source, g.quads.length, g.glyphs.length])).toEqual([['color', 1, 0]]);
  });

  it('tracks the cluster once, after it', () => {
    stubRasterizer();
    const out = layoutAndPaint([{ ...RUN_PLAIN(`${TONED}B`), letterSpacing: 5 }], OPTS);
    const cells = out.lines[0].cells;
    expect(cells[cells.length - 1].x).toBeCloseTo(48 * CANVAS_SCALE + 5);
  });

  it('lays a cluster the platform draws no color for out code point by code point, as before', () => {
    stubRasterizer(() => false);
    const out = layoutAndPaint([RUN_PLAIN(TONED)], OPTS);
    expect(out.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, true]);
    expect(out.groups.map((g) => g.source)).toEqual(['canvas']);
  });

  it('paints no color glyph for a run with no fill', () => {
    stubRasterizer();
    const out = layoutAndPaint([{ ...RUN_PLAIN(TONED), fill: null }], OPTS);
    expect(out.groups).toEqual([]);
  });
});
