/**
 * `textToPath` laws: outlines are finite, move with the pose and nothing else, split by paint into exactly the
 * whole, and a `{ px }` size at view scale `k` draws what its world size does.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import type { PolygonPath } from '@weasel-js/geom';
import { textToPath, textToPathsByPaint, type TextOutlineSource } from './textToPath';
import { mixedText, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

/** A bar per code point, its height by the code point so glyphs differ. */
const BARS: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: (cp) => (/\p{Mn}/u.test(String.fromCodePoint(cp)) ? 0 : 0.55),
  kernOf: () => 0,
  glyphD: (cp) => `M0 -${0.2 + (cp % 7) / 10}L0.3 -${0.2 + (cp % 7) / 10}L0.3 0L0 0Z`,
};

beforeAll(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadFontOutlines('bars');
});

const noEmoji = (t: string) => t.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3\ufe0f]/gu, 'x');
const RED = { paint: { kind: 'solid', color: '#f00' } } as const;
const INK = { paint: { kind: 'solid', color: '#000' } } as const;

// Italic is left out: an outline face with no italic of its own draws none (docs/unruled.md, open).
const source: fc.Arbitrary<TextOutlineSource> = fc.record({
  text: mixedText(10).map(noEmoji),
  fontSize: fc.constantFrom(12, 100, 2500),
  align: fc.constantFrom('left' as const, 'center' as const, 'right' as const),
  underline: fc.boolean(),
  split: fc.nat(12),
}).map(({ text, fontSize, align, underline, split }) => {
  const at = Math.min(split, text.length);
  return {
    text,
    runs: [{ text: text.slice(0, at), fill: RED }, { text: text.slice(at), rotate: 30 }],
    style: { fontFamily: 'bars', fontSize, align, underline },
    fill: INK,
  };
});


/** Each point of `p`, measured from its origin, less `(dx, dy)`. */
function pointsOf(p: PolygonPath, dx: number, dy: number): [number, number][] {
  const out: [number, number][] = [];
  const ox = (p.origin?.x ?? 0) - dx;
  const oy = (p.origin?.y ?? 0) - dy;
  for (let k = 0; k + 1 < p.coords.length; k += 2) out.push([p.coords[k]! + ox, p.coords[k + 1]! + oy]);
  return out;
}

describe('textToPath, property', () => {
  it('draws finite outlines that move with the pose alone, and split by paint into the whole', () => {
    const t = tally();
    fc.assert(fc.property(source, fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }), (data, dx, dy) => {
      const pose = { x: 10, y: 20, width: 800, height: 300 };
      const at = textToPath(data, pose);
      for (const v of at.coords) expect(Number.isFinite(v)).toBe(true);
      const moved = textToPath(data, { ...pose, x: pose.x + dx, y: pose.y + dy });
      expect(moved.commands.length).toBe(at.commands.length);
      // Glyphs may come in another order; the points, moved back, are the same set.
      const a = pointsOf(at, 0, 0);
      for (const [x, y] of pointsOf(moved, dx, dy)) {
        const tol = 2e-3 * Math.max(1, Math.abs(x), Math.abs(y));
        expect(a.some(([u, v]) => Math.abs(x - u) + Math.abs(y - v) < tol), `${x},${y}`).toBe(true);
      }
      const parts = textToPathsByPaint(data, pose);
      expect(parts.reduce((n, p) => n + p.path.commands.length, 0)).toBe(at.commands.length);
      if (parts.length === 2) t.count('two paints');
    }), runs(RUNS));
    t.atLeast('two paints', 30);
  }, timeoutFor(RUNS, 20));

  it('draws a size in screen pixels at view scale k as the same size in world units over k', () => {
    fc.assert(fc.property(mixedText(8).map(noEmoji), fc.constantFrom(0.5, 2, 4), (text, k) => {
      const pose = { x: 0, y: 0, width: 800, height: 300 };
      const px = textToPath({ text, style: { fontFamily: 'bars', fontSize: { px: 40 } }, fill: INK }, pose, { scale: k });
      const world = textToPath({ text, style: { fontFamily: 'bars', fontSize: 40 / k }, fill: INK }, pose);
      expect(pointsOf(px, 0, 0)).toEqual(pointsOf(world, 0, 0));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 10));
});
