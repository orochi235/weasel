import { describe, expect, it } from 'vitest';
import { strokeHitTest } from './pathHitTest';
import { PATH_L, PATH_M, PATH_Z } from './commands';
import { scale } from './affine';
import type { Path } from './path';

const poly = (commands: number[], coords: number[], origin?: { x: number; y: number }): Path => ({
  kind: 'polygon',
  commands: Uint8Array.from(commands),
  coords: Float32Array.from(coords),
  fillRule: 'nonzero',
  ...(origin ? { origin } : {}),
});

const LINE = poly([PATH_M, PATH_L], [0, 0, 100, 0]);

describe('strokeHitTest — span', () => {
  it('misses a point near the path outside the span', () => {
    const span = { from: 0, to: 50 };
    expect(strokeHitTest(LINE, 25, 0, 2, { span })).toBe(true);
    expect(strokeHitTest(LINE, 75, 0, 2, { span })).toBe(false);
    expect(strokeHitTest(LINE, 75, 0, 2)).toBe(true);
  });

  it('reaches past the span end as far as past a path end', () => {
    const span = { from: 20, to: 50 };
    expect(strokeHitTest(LINE, 51.9, 0, 2, { span })).toBe(true);
    expect(strokeHitTest(LINE, 52.1, 0, 2, { span })).toBe(false);
    expect(strokeHitTest(LINE, 18.1, 0, 2, { span })).toBe(true);
    expect(strokeHitTest(LINE, 17.9, 0, 2, { span })).toBe(false);
  });

  it('measures a closed subpath in pen order, closing edge last', () => {
    const square = poly([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z], [0, 0, 10, 0, 10, 10, 0, 10]);
    const span = { from: 30, to: 40 };
    expect(strokeHitTest(square, 0, 5, 1, { span })).toBe(true);
    expect(strokeHitTest(square, 5, 0, 1, { span })).toBe(false);
    expect(strokeHitTest(square, 10, 5, 1, { span })).toBe(false);
  });

  it('crosses from one subpath to the next at no cost', () => {
    const two = poly([PATH_M, PATH_L, PATH_M, PATH_L], [0, 0, 10, 0, 0, 20, 10, 20]);
    const span = { from: 12, to: 20 };
    expect(strokeHitTest(two, 5, 0, 1, { span })).toBe(false);
    expect(strokeHitTest(two, 0.5, 20, 1, { span })).toBe(false);
    expect(strokeHitTest(two, 5, 20, 1, { span })).toBe(true);
  });

  it('reads a path origin', () => {
    const shifted = poly([PATH_M, PATH_L], [0, 0, 100, 0], { x: 1000, y: 0 });
    expect(strokeHitTest(shifted, 1025, 0, 2, { span: { from: 0, to: 50 } })).toBe(true);
    expect(strokeHitTest(shifted, 1075, 0, 2, { span: { from: 0, to: 50 } })).toBe(false);
  });

  it('walks a rect from its top-left corner clockwise', () => {
    const rect: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const span = { from: 0, to: 10 };
    expect(strokeHitTest(rect, 5, 0, 1, { span })).toBe(true);
    expect(strokeHitTest(rect, 10, 5, 1, { span })).toBe(false);
    expect(strokeHitTest(rect, 0, 5, 1, { span })).toBe(false);
  });

  it('cuts a rect span across a corner and into its closing edge', () => {
    const rect: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const span = { from: 25, to: 35 };
    expect(strokeHitTest(rect, 2, 10, 0.5, { span })).toBe(true);
    expect(strokeHitTest(rect, 8, 10, 0.5, { span })).toBe(false);
    expect(strokeHitTest(rect, 0, 8, 0.5, { span })).toBe(true);
    expect(strokeHitTest(rect, 0, 2, 0.5, { span })).toBe(false);
    expect(strokeHitTest(rect, 10, 5, 0.5, { span })).toBe(false);
  });

  it('an empty span hits nothing', () => {
    expect(strokeHitTest(LINE, 25, 0, 2, { span: { from: 30, to: 30 } })).toBe(false);
    expect(strokeHitTest(LINE, 25, 0, 2, { span: { from: 40, to: 10 } })).toBe(false);
  });

  it('holds under a screen slop', () => {
    const span = { from: 0, to: 50 };
    for (const transform of [scale(2, 2), scale(4, 1)]) {
      const slop = { px: 4, transform };
      expect(strokeHitTest(LINE, 25, 0, 0, { span, slop })).toBe(true);
      expect(strokeHitTest(LINE, 75, 0, 0, { span, slop })).toBe(false);
    }
  });
});
