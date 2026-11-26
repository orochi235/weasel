import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { lottieShapesOf } from './shape';

describe('lottieShapesOf', () => {
  it('writes a square as one closed bezier of four vertices with zero tangents', () => {
    const [square, ...rest] = lottieShapesOf(pathFromD('M0 0 L10 0 L10 10 L0 10 Z'));
    expect(rest).toEqual([]);
    expect(square).toEqual({
      c: true,
      v: [[0, 0], [10, 0], [10, 10], [0, 10]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0]],
      o: [[0, 0], [0, 0], [0, 0], [0, 0]],
    });
  });

  it('writes an open polyline as an open bezier ending at its last point', () => {
    const [line] = lottieShapesOf(pathFromD('M0 0 L10 0 L10 10'));
    expect(line.c).toBe(false);
    expect(line.v).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it('writes each subpath of a shape with a counter as its own bezier', () => {
    expect(lottieShapesOf(pathFromD('M0 0 L30 0 L30 30 L0 30 Z M10 10 L10 20 L20 20 L20 10 Z')).map((b) => b.v.length)).toEqual([4, 4]);
  });

  it('writes a cubic tangent relative to its vertex, the out on the start and the in on the end', () => {
    const [curve] = lottieShapesOf(pathFromD('M0 0 C5 -10 15 -10 20 0'));
    expect(curve.o[0]).toEqual([5, -10]);
    expect(curve.i[1]).toEqual([-5, -10]);
  });

  it('raises a quadratic to the cubic that draws it', () => {
    const [curve] = lottieShapesOf(pathFromD('M0 0 Q15 30 30 0'));
    expect(curve.o[0]).toEqual([10, 20]);
    expect(curve.i[1]).toEqual([-10, 20]);
  });

  it('puts the closing curve\'s in tangent on the first vertex', () => {
    const [loop] = lottieShapesOf(pathFromD('M0 0 L20 0 C20 10 0 10 0 0 Z'));
    expect(loop.c).toBe(true);
    expect(loop.v).toEqual([[0, 0], [20, 0]]);
    expect(loop.o[1]).toEqual([0, 10]);
    expect(loop.i[0]).toEqual([0, 10]);
  });
});
