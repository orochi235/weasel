import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { pathFromD } from './pathFromD';
import { roughenPath } from './roughenPath';

const square = pathFromD('M0 0 H10 V10 H0 Z');
const coords = (seed: number) => Array.from((roughenPath(square, { size: 1, seed }) as PolygonPath).coords);

describe('roughenPath', () => {
  it('roughens the same way for the same seed', () => {
    expect(coords(0.25)).toEqual(coords(0.25));
  });

  it('roughens differently for seeds that differ only in their fraction or past 32 bits', () => {
    expect(coords(0.25)).not.toEqual(coords(0));
    expect(coords(0.25)).not.toEqual(coords(0.75));
    expect(coords(2 ** 32 + 1)).not.toEqual(coords(1));
  });
});
