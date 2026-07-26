import { describe, it, expect } from 'vitest';
import { mat3 } from './mat3';

describe('mat3', () => {
  it('identity is [1, 0, 0, 0, 1, 0, 0, 0, 1] (column-major)', () => {
    const m = mat3.identity();
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('translate(10, 20) applied to (0, 0) yields (10, 20)', () => {
    const m = mat3.translate(mat3.identity(), 10, 20);
    const [x, y] = mat3.apply(m, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
  });

  it('scale(2, 3) applied to (5, 5) yields (10, 15)', () => {
    const m = mat3.scale(mat3.identity(), 2, 3);
    const [x, y] = mat3.apply(m, 5, 5);
    expect(x).toBe(10);
    expect(y).toBe(15);
  });

  it('multiply: translate then scale composes correctly', () => {
    const t = mat3.translate(mat3.identity(), 10, 20);
    const s = mat3.scale(mat3.identity(), 2, 2);
    const composed = mat3.multiply(t, s);
    const [x, y] = mat3.apply(composed, 1, 1);
    expect(x).toBe(12);
    expect(y).toBe(22);
  });

  it('screenToClip(800, 600) maps (0,0) → (-1, 1) and (800,600) → (1, -1) (Y-flip)', () => {
    const m = mat3.screenToClip(800, 600);
    const [x0, y0] = mat3.apply(m, 0, 0);
    const [x1, y1] = mat3.apply(m, 800, 600);
    expect(x0).toBeCloseTo(-1);
    expect(y0).toBeCloseTo(1);
    expect(x1).toBeCloseTo(1);
    expect(y1).toBeCloseTo(-1);
  });
});
