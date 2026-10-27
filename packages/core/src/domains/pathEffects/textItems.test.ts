/**
 * `textEffectItems`: a text node's grapheme clusters as the items a path
 * effect lays, against a face whose glyphs are plain bars.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, loadFontOutlines, faceGeneration, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { boundsOfPath, type PathInWorldPose } from '@weasel-js/geom';
import { loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import { withFontReads } from 'core/scene/fontReads';
import { textEffectItems } from './textItems';

/** Every code point a 0.6 em bar, half an em tall. */
const BARS: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: () => 0.6,
  kernOf: () => 0,
  glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};

const INK = { paint: { kind: 'solid', color: '#000' } } as const;
const text = (s: string, family = 'bars'): TextOutlineSource => ({
  text: s, style: { fontFamily: family, fontSize: 100 }, fill: INK,
});
const POSE: PathInWorldPose = { x: 10, y: 20, width: 400, height: 120 };

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadFontOutlines('bars');
});

function bounds(items: ReturnType<typeof textEffectItems>) {
  return items.map((it) => it.parts.map((p) => boundsOfPath(p.path)));
}

describe('textEffectItems', () => {
  it("a text node's items are its clusters", () => {
    const items = textEffectItems(text('Hi'), POSE);
    expect(items.map((it) => it.length)).toEqual([60, 60]);
    expect(items[0]!.parts).toHaveLength(1);
    expect(items[0]!.parts[0]!.fill).toEqual(INK);
    expect(boundsOfPath(items[0]!.parts[0]!.path)).toMatchObject({ x: 0, width: 20, height: 50 });
  });

  it('rotation is ignored and scale grows the glyphs', () => {
    const plain = textEffectItems(text('Hi'), POSE);
    expect(textEffectItems(text('Hi'), { ...POSE, rotation: 30 })).toEqual(plain);
    const scaled = textEffectItems(text('Hi'), { ...POSE, transform: [2, 0, 0, 2] });
    expect(scaled.map((it) => it.length)).toEqual(plain.map((it) => it.length * 2));
    expect(scaled.map((it) => it.middle)).toEqual(plain.map((it) => it.middle * 2));
    const twice = bounds(plain).map((b) => b.map((r) => ({
      ...r, x: r.x * 2, y: r.y * 2, width: r.width * 2, height: r.height * 2,
    })));
    expect(bounds(scaled)).toEqual(twice);
  });

  it("a cluster's decoration rules come as bands, grown with the glyphs", () => {
    const ruled: TextOutlineSource = { text: 'Hi', style: { fontFamily: 'bars', fontSize: 100, underline: true }, fill: INK };
    const plain = textEffectItems(ruled, POSE);
    expect(plain.map((it) => it.bands?.length)).toEqual([1, 1]);
    const [band] = plain[0]!.bands!;
    expect(band).toMatchObject({ x0: 0, x1: 60, fill: INK, stroke: null });
    expect(band!.y1).toBeGreaterThan(band!.y0);
    const [twice] = textEffectItems(ruled, { ...POSE, transform: [2, 0, 0, 2] })[0]!.bands!;
    expect(twice).toEqual({ ...band, x0: 0, x1: 120, y0: band!.y0 * 2, y1: band!.y1 * 2 });
    expect(textEffectItems(text('Hi'), POSE)[0]!.bands).toEqual([]);
  });

  it('empty and space-only text has no ink', () => {
    expect(textEffectItems(text(''), POSE)).toEqual([]);
    const spaces = textEffectItems(text('  '), POSE);
    expect(spaces.length).toBeGreaterThan(0);
    for (const it of spaces) expect(it.parts).toEqual([]);
  });

  it('outlines still loading answer no items and note a font read, and items appear once they land', async () => {
    registerFontOutlines('late', {}, new ArrayBuffer(4), { parser: () => BARS });
    const src = text('Hi', 'late');
    const read = withFontReads(() => textEffectItems(src, POSE));
    expect(read.value).toEqual([]);
    expect(read.fonts).toBe(true);
    const before = faceGeneration();
    await loadTextOutlines(src);
    expect(faceGeneration()).not.toBe(before);
    expect(textEffectItems(src, POSE)).toHaveLength(2);
  });

  it('notes a font read when the outlines are there too', () => {
    expect(withFontReads(() => textEffectItems(text('Hi'), POSE)).fonts).toBe(true);
  });
});
