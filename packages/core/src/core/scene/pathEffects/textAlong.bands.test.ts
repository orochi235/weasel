/**
 * `textAlongParts` with bands — a decoration rule cut into the items it crosses — on the same synthetic 10×10
 * squares as `textAlong.test.ts`: alike bands on neighboring items join into one ribbon along the path.
 */
import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD, rectPath, type Path } from '@weasel-js/geom';
import type { DerivedPart } from '../derivedParts';
import type { EffectBand, EffectItem } from './source';
import { textAlongParts, type TextAlongEffect } from './textAlong';

const INK = { paint: { kind: 'solid', color: '#000' } } as const;
const RED = { paint: { kind: 'solid', color: '#f00' } } as const;
const GLYPH = { paint: { kind: 'solid', color: '#00f' } } as const;
const LINE = pathFromD('M0 0 L100 0');
const under = (over: Partial<EffectBand> = {}): EffectBand => ({ x0: 0, x1: 10, y0: 2, y1: 3, fill: INK, stroke: null, ...over });
const item = (bands: EffectBand[] = [under()]): EffectItem => ({
  length: 10, middle: 4, parts: [{ path: rectPath(0, -10, 10, 10), fill: GLYPH }], bands,
});
const items = (n: number, bands?: EffectBand[]) => Array.from({ length: n }, () => item(bands));

/** The parts that are ribbons rather than glyph squares. */
const ribbons = (parts: readonly DerivedPart[]) => parts.filter((p) => p.fill !== GLYPH);
const lay = (effect: Partial<TextAlongEffect>, its: EffectItem[], path: Path = LINE) =>
  ribbons(textAlongParts({ kind: 'textAlong', ...effect }, its, path));
const box = (p: DerivedPart) => {
  const b = boundsOfPath(p.path);
  return [b.x, b.y, b.x + b.width, b.y + b.height];
};
const near = (...vs: number[]) => vs.map((v) => expect.closeTo(v, 5));
const vertices = (p: DerivedPart) => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < p.path.coords.length; i += 2) out.push({ x: p.path.coords[i]!, y: p.path.coords[i + 1]! });
  return out;
};

describe('textAlongParts bands', () => {
  it('alike bands on neighboring items are one ribbon across them, below the baseline', () => {
    const got = lay({}, items(3));
    expect(got).toHaveLength(1);
    expect(box(got[0]!)).toEqual(near(0, 2, 30, 3));
    expect(got[0]!.fill).toBe(INK);
  });

  it('a band in another paint, at another depth, or ending inside its slot starts a ribbon of its own', () => {
    expect(lay({}, [item(), item([under({ fill: RED })]), item()])).toHaveLength(3);
    expect(lay({}, [item(), item([under({ y0: 5, y1: 6 })])])).toHaveLength(2);
    expect(lay({}, [item([under({ x1: 6 })]), item()])).toHaveLength(2);
    expect(lay({}, [item(), item([]), item()])).toHaveLength(2);
  });

  it('a band cut short in its slot is cut short along the path', () => {
    const [r] = lay({}, [item([under({ x0: 3, x1: 6 })])]);
    expect(box(r!)).toEqual(near(3, 2, 6, 3));
  });

  it('runs over the gaps fit opens, and stops where clip drops items', () => {
    expect(lay({ overflow: 'fit' }, items(15)).map(box)).toEqual([near(0, 2, 100, 3)]);
    expect(lay({}, items(15)).map(box)).toEqual([near(0, 2, 100, 3)]);
  });

  it('moves with shift and the center anchor, as the glyphs do', () => {
    expect(box(lay({ shift: 4 }, items(2))[0]!)).toEqual(near(0, -2, 20, -1));
    expect(box(lay({ anchor: 'center' }, items(2))[0]!)).toEqual(near(0, 6, 20, 7));
  });

  it('bends with the path rather than standing straight across it', () => {
    // A circle of radius 100 about the origin; the text stands on its outside.
    const CIRCLE = pathFromD('M0 -100 A100 100 0 0 1 0 100 A100 100 0 0 1 0 -100 Z');
    const [r] = lay({ align: 'center', start: 0 }, items(8), CIRCLE);
    const radii = vertices(r!).map((p) => Math.hypot(p.x, p.y));
    expect(radii.length).toBeGreaterThan(8);
    // Within the arc's flattening, which the glyphs' places share.
    for (const d of radii) {
      expect(Math.abs(d - 100)).toBeGreaterThan(2 - 0.2);
      expect(Math.abs(d - 100)).toBeLessThan(3 + 0.2);
    }
  });

  it('a ribbon wraps round a closed path past its seam', () => {
    const SQUARE = pathFromD('M0 0 H100 V100 H0 Z');
    const got = lay({ start: 0.95 }, items(4), SQUARE);
    expect(got).toHaveLength(1);
    // 380..420 of 400: up the left edge, then along the top, the band standing in from both.
    const vs = vertices(got[0]!);
    expect(Math.max(...vs.map((p) => p.y))).toBeGreaterThan(15);
    expect(Math.max(...vs.map((p) => p.x))).toBeGreaterThan(15);
  });
});
