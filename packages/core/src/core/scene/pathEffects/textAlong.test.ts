/**
 * `textAlongParts`: synthetic items — 10×10 squares standing on the baseline, `middle` 2 — laid along paths, so no
 * font is involved. Expected positions are worked from the path by hand.
 */
import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD, pathShape, rectPath, type Path } from '@weasel-js/geom';
import type { DerivedPart } from '../derivedParts';
import { effectParts } from './effects';
import type { EffectItem } from './source';
import { textAlongParts, type TextAlongEffect } from './textAlong';

const INK = { paint: { kind: 'solid', color: '#000' } } as const;
const square = (): EffectItem => ({ length: 10, middle: 2, parts: [{ path: rectPath(0, -10, 10, 10), fill: INK }] });
const squares = (n: number): EffectItem[] => Array.from({ length: n }, square);
const FX: TextAlongEffect = { kind: 'textAlong' };
const LINE = pathFromD('M0 0 L100 0');

const centers = (parts: readonly DerivedPart[]) => parts.map((p) => {
  const b = boundsOfPath(p.path);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
});
const lay = (effect: Partial<TextAlongEffect>, n: number, path: Path = LINE) =>
  centers(textAlongParts({ ...FX, ...effect }, squares(n), path));

describe('textAlongParts', () => {
  it('items follow a straight path in order', () => {
    const got = lay({}, 3);
    expect(got.map((c) => c.x)).toEqual([5, 15, 25].map((x) => expect.closeTo(x, 9)));
    for (const c of got) {
      expect(c.y).toBeCloseTo(-5, 9);
      expect([c.w, c.h].map((v) => Math.round(v))).toEqual([10, 10]);
    }
  });

  it('align and start', () => {
    expect(lay({ align: 'center', start: 0.5 }, 3)[1]!.x).toBeCloseTo(50, 9);
    expect(lay({ align: 'end', start: 1 }, 3)[2]!.x + 5).toBeCloseTo(100, 9);
  });

  it('shift raises the line', () => {
    const base = lay({}, 3);
    lay({ shift: 4 }, 3).forEach((c, i) => expect(c.y).toBeCloseTo(base[i]!.y - 4, 9));
  });

  it('anchor center sits items on their middle', () => {
    const base = lay({}, 3);
    lay({ anchor: 'center' }, 3).forEach((c, i) => expect(c.y).toBeCloseTo(base[i]!.y + 2, 9));
  });

  it("clip drops items past an open path's end", () => {
    expect(lay({}, 15)).toHaveLength(10);
  });

  it('clip drops items before an open path\'s start', () => {
    expect(lay({ align: 'end', start: 0.2 }, 4)).toHaveLength(2);
  });

  describe('turned over, text keeps its stretch of an open path and drops what falls off it', () => {
    // Item i is i + 1 tall, so the heights name which items were drawn.
    const tall = (n: number) => Array.from({ length: n }, (_, i): EffectItem => ({
      length: 10, middle: 0, parts: [{ path: rectPath(0, -(i + 1), 10, i + 1), fill: INK }],
    }));
    const drawn = (effect: Partial<TextAlongEffect>, n: number) =>
      centers(textAlongParts({ ...FX, ...effect }, tall(n), LINE)).map((c) => ({ x: c.x, h: Math.round(c.h) }));

    it("at start 0.9 both sides show only the path's 90..100, each the letter that falls there", () => {
      expect(drawn({ side: 'path', start: 0.9 }, 3)).toEqual([{ x: expect.closeTo(95, 9), h: 1 }]);
      expect(drawn({ side: 'flipped', start: 0.9 }, 3)).toEqual([{ x: expect.closeTo(95, 9), h: 3 }]);
    });

    it('at start 0, overflowing text turned over loses its reading start', () => {
      const got = drawn({ side: 'flipped' }, 15);
      expect(got.map((c) => c.h)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      expect(got[0]!.x).toBeCloseTo(95, 9);
    });
  });

  it('fit squeezes them in', () => {
    const got = lay({ overflow: 'fit' }, 15);
    expect(got).toHaveLength(15);
    expect(got[0]!.x - 5).toBeCloseTo(0, 9);
    expect(got[14]!.x + 5).toBeCloseTo(100, 9);
  });

  it('fit keeps the order when the room is shorter than one item', () => {
    const got = lay({ overflow: 'fit', start: 0.95 }, 3);
    expect(got).toHaveLength(3);
    for (let i = 1; i < got.length; i++) expect(got[i]!.x).toBeGreaterThanOrEqual(got[i - 1]!.x - 1e-9);
  });

  it('a NaN shift is no shift', () => {
    const base = lay({}, 3);
    lay({ shift: Number.NaN }, 3).forEach((c, i) => expect(c.y).toBeCloseTo(base[i]!.y, 9));
  });

  it('a closed path wraps past its seam', () => {
    const SQUARE = pathFromD('M0 0 H100 V100 H0 Z');
    // 380..420 of 400: two items up the left edge, two along the top.
    const four = lay({ start: 0.95 }, 4, SQUARE);
    expect(four).toHaveLength(4);
    expect(four.filter((c) => c.x < 0)).toHaveLength(2);
    expect(four.filter((c) => c.y < 0)).toHaveLength(2);
    // 50 items take 500; the ten whose middles fall a full 400 past the first item's start are dropped.
    expect(lay({ start: 0.95 }, 50, SQUARE)).toHaveLength(40);
  });

  describe("side 'auto' reads left to right below a curve, 'path' and 'flipped' override", () => {
    // Drawn right to left along its bottom, at (50, 75) halfway; its own normal there points down.
    const U = pathFromD('M100 0 C 100 100 0 100 0 0');
    const at = (side: TextAlongEffect['side']) => lay({ side, align: 'center', start: 0.5 }, 2, U);

    it("'auto' is upright and left to right", () => {
      const [first, last] = at('auto');
      expect(first!.x).toBeLessThan(last!.x);
      expect(first!.y).toBeLessThan(75);
      expect(last!.y).toBeLessThan(75);
    });

    it("'path' follows the path's own direction, below it", () => {
      const [first, last] = at('path');
      expect(first!.x).toBeGreaterThan(last!.x);
      expect(first!.y).toBeGreaterThan(75);
    });

    it("'flipped' is the reverse of 'path'", () => {
      expect(at('flipped')).toEqual(at('auto'));
      // The same U drawn left to right: 'auto' is now 'path', and 'flipped' hangs below it, reading right to left.
      const U2 = pathFromD('M0 0 C 0 100 100 100 100 0');
      const two = (side: TextAlongEffect['side']) => lay({ side, align: 'center', start: 0.5 }, 2, U2);
      expect(two('path')).toEqual(two('auto'));
      const [first, last] = two('flipped');
      expect(first!.x).toBeGreaterThan(last!.x);
      expect(first!.y).toBeGreaterThan(75);
    });
  });

  it('a curve that turns back under auto turns over where the text lies', () => {
    // Heads right along its top and left along its bottom.
    const S = pathFromD('M0 0 C 150 0 150 100 0 100');
    const shape = pathShape(S)!;
    for (const start of [0.1, 0.9]) {
      const got = lay({ start, align: 'center' }, 2, S);
      expect(got).toHaveLength(2);
      expect(got[0]!.x).toBeLessThan(got[1]!.x);
      for (const c of got) {
        const on = shape.at(shape.nearest(c).f).point;
        expect(c.y).toBeLessThan(on.y);
      }
    }
  });

  it('nothing to lay or nowhere to lay it paints nothing', () => {
    expect(textAlongParts(FX, [], LINE)).toEqual([]);
    expect(textAlongParts(FX, squares(3), pathFromD('M5 5'))).toEqual([]);
    expect(textAlongParts(FX, squares(3), pathFromD('M5 5 L5 5'))).toEqual([]);
    const compound = textAlongParts(FX, squares(12), pathFromD('M0 0 L50 0 M0 20 L50 20'));
    expect(compound).toHaveLength(10);
    for (const c of centers(compound)) for (const v of Object.values(c)) expect(Number.isFinite(v)).toBe(true);
  });

  it('via effectParts, a source without items lays its whole outline as one item', () => {
    const a = { world: rectPath(200, 300, 20, 10), fill: INK, stroke: null };
    const b = { world: LINE, fill: null, stroke: null };
    const parts = effectParts(FX, [a, b])!;
    expect(parts).toHaveLength(1);
    expect(parts[0]!.fill).toBe(INK);
    expect(centers(parts)[0]).toEqual({ x: expect.closeTo(10, 9), y: expect.closeTo(0, 9), w: 20, h: 10 });
  });

  it('via effectParts, a source with items lays them', () => {
    const a = { world: rectPath(200, 300, 20, 10), fill: INK, stroke: null, items: () => squares(2) };
    const b = { world: LINE, fill: null, stroke: null };
    expect(centers(effectParts(FX, [a, b])!).map((c) => c.x)).toEqual([5, 15].map((x) => expect.closeTo(x, 9)));
  });
});
