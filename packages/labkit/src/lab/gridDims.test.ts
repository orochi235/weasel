import { describe, expect, test } from 'vitest';
import { gridDims } from './gridDims';

describe('gridDims', () => {
  test('returns 1x1 for 0 or 1', () => {
    expect(gridDims(0)).toEqual({ cols: 1, rows: 1 });
    expect(gridDims(1)).toEqual({ cols: 1, rows: 1 });
  });

  test('returns 2x1 for 2', () => {
    expect(gridDims(2)).toEqual({ cols: 2, rows: 1 });
  });

  test('returns 2x2 for 3 or 4', () => {
    expect(gridDims(3)).toEqual({ cols: 2, rows: 2 });
    expect(gridDims(4)).toEqual({ cols: 2, rows: 2 });
  });

  test('returns 3x2 for 5 or 6', () => {
    expect(gridDims(5)).toEqual({ cols: 3, rows: 2 });
    expect(gridDims(6)).toEqual({ cols: 3, rows: 2 });
  });

  test('returns 3x3 for 9', () => {
    expect(gridDims(9)).toEqual({ cols: 3, rows: 3 });
  });

  test('returns 4x4 for 16', () => {
    expect(gridDims(16)).toEqual({ cols: 4, rows: 4 });
  });

  test('returns 4x4 for 13 (sqrt rounds up to 4)', () => {
    expect(gridDims(13)).toEqual({ cols: 4, rows: 4 });
  });
});
