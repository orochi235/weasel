import { describe, expect, it } from 'vitest';
import { pathCrop, pathCropPieces, pathDivide, pathDividePieces, pathFacePieces, pathMerge, pathTrim } from './index';
import type { RectPath } from '../path';
import { pointInPath } from '../pathHitTest';

const r = (x: number, y: number, w: number, h: number): RectPath => ({
  kind: 'rect', x, y, width: w, height: h,
});

describe('pathDividePieces', () => {
  it('names every input covering each piece, back to front', () => {
    const pieces = pathDividePieces(r(0, 0, 10, 10), r(5, 0, 10, 10));
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1], [0, 1]]);
    expect(pointInPath(pieces[0].path, 2, 5)).toBe(true);
    expect(pointInPath(pieces[1].path, 12, 5)).toBe(true);
    expect(pointInPath(pieces[2].path, 7, 5)).toBe(true);
  });

  it('skips the subsets that cover nothing', () => {
    const pieces = pathDividePieces(r(0, 0, 10, 10), r(20, 0, 10, 10), r(5, 0, 10, 10));
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1], [2], [0, 2]]);
  });

  it('gives pathDivide its paths, in the same order', () => {
    const inputs = [r(0, 0, 10, 10), r(5, 0, 10, 10), r(0, 5, 10, 10)];
    expect(pathDivide(...inputs)).toEqual(pathDividePieces(...inputs).map((p) => p.path));
  });

  it('names a lone input as its own source', () => {
    expect(pathDividePieces(r(0, 0, 10, 10)).map((p) => p.sources)).toEqual([[0]]);
  });
});

describe('pathFacePieces', () => {
  it('splits a region that falls apart into one piece per connected face', () => {
    // The bar crosses the box, leaving the box two faces on either side of it.
    const pieces = pathFacePieces(r(0, 0, 30, 10), r(10, -5, 10, 20));
    expect(pieces.map((p) => p.sources)).toEqual([[0], [0], [1], [1], [0, 1]]);
    const holds = (x: number, y: number) => pieces.findIndex((p) => pointInPath(p.path, x, y));
    expect(new Set([holds(5, 5), holds(25, 5), holds(15, -2), holds(15, 12), holds(15, 5)]).size).toBe(5);
  });

  it('keeps a face with a hole as one piece', () => {
    const pieces = pathFacePieces(r(0, 0, 30, 30), r(10, 10, 10, 10));
    expect(pieces.map((p) => p.sources)).toEqual([[0], [0, 1]]);
    expect(pointInPath(pieces[0]!.path, 15, 15)).toBe(false);
  });
});

describe('pathCropPieces', () => {
  it('names the input each piece was clipped from, skipping one outside the mask', () => {
    const pieces = pathCropPieces(r(0, 0, 5, 5), r(100, 100, 5, 5), r(0, 5, 5, 5), r(0, 0, 10, 10));
    expect(pieces.map((p) => p.sources)).toEqual([[0], [2]]);
    expect(pointInPath(pieces[1].path, 2, 7)).toBe(true);
  });

  it('gives pathCrop its paths', () => {
    const inputs = [r(0, 0, 10, 10), r(0, 10, 10, 10), r(5, 0, 20, 20)];
    expect(pathCrop(...inputs)).toEqual(pathCropPieces(...inputs).map((p) => p.path));
  });
});

describe('pathTrim', () => {
  it('removes from each input what the inputs in front of it cover', () => {
    const pieces = pathTrim(r(0, 0, 10, 10), r(5, 0, 10, 10), r(12, 0, 10, 10));
    expect(pieces.map((p) => p.sources)).toEqual([[0], [1], [2]]);
    expect(pointInPath(pieces[0].path, 2, 5)).toBe(true);
    expect(pointInPath(pieces[0].path, 7, 5)).toBe(false);
    expect(pointInPath(pieces[1].path, 7, 5)).toBe(true);
    expect(pointInPath(pieces[1].path, 13, 5)).toBe(false);
    expect(pointInPath(pieces[2].path, 13, 5)).toBe(true);
  });

  it('drops an input that is wholly hidden', () => {
    const pieces = pathTrim(r(2, 2, 4, 4), r(0, 0, 10, 10));
    expect(pieces.map((p) => p.sources)).toEqual([[1]]);
  });

  it('answers nothing for no inputs and the input itself for one', () => {
    expect(pathTrim()).toEqual([]);
    const [only] = pathTrim(r(0, 0, 10, 10));
    expect(only.sources).toEqual([0]);
    expect(pointInPath(only.path, 5, 5)).toBe(true);
  });
});

describe('pathMerge', () => {
  it('unites the trimmed pieces of inputs with the same key', () => {
    const inputs = [r(0, 0, 10, 10), r(5, 0, 10, 10), r(12, 0, 10, 10)];
    const pieces = pathMerge(inputs, (i) => (i === 1 ? 'blue' : 'red'));
    expect(pieces.map((p) => p.sources)).toEqual([[1], [0, 2]]);
    const red = pieces[1].path;
    expect(pointInPath(red, 2, 5)).toBe(true);
    expect(pointInPath(red, 20, 5)).toBe(true);
    expect(pointInPath(red, 7, 5)).toBe(false);
    // The blue piece still loses what the red one in front of it covers.
    expect(pointInPath(pieces[0].path, 13, 5)).toBe(false);
  });

  it('is pathTrim when every key differs', () => {
    const inputs = [r(0, 0, 10, 10), r(5, 0, 10, 10)];
    expect(pathMerge(inputs, (i) => i)).toEqual(pathTrim(...inputs));
  });

  it('leaves a hidden input out of the sources of its group', () => {
    const pieces = pathMerge([r(2, 2, 4, 4), r(0, 0, 10, 10)], () => 'red');
    expect(pieces.map((p) => p.sources)).toEqual([[1]]);
  });
});
