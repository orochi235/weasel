import { describe, expect, it } from 'vitest';
import { viewToMat3 } from './viewToMat3';

describe('viewToMat3', () => {
  it('identity view → identity mat3', () => {
    expect(Array.from(viewToMat3({ x: 0, y: 0, scale: 1 }))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('view {x:10, y:20, scale:2} → translate(-20,-40) then scale(2) (column-major)', () => {
    const m = viewToMat3({ x: 10, y: 20, scale: 2 });
    expect(Array.from(m)).toEqual([2, 0, 0, 0, 2, 0, -20, -40, 1]);
  });

  it('maps world (10, 20) → screen (0, 0) under view {10, 20, 2}', () => {
    const m = viewToMat3({ x: 10, y: 20, scale: 2 });
    const x = 10;
    const y = 20;
    // Apply column-major mat3 to (x, y, 1).
    const sx = m[0] * x + m[3] * y + m[6];
    const sy = m[1] * x + m[4] * y + m[7];
    expect(sx).toBe(0);
    expect(sy).toBe(0);
  });
});
