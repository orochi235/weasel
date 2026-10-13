import { describe, expect, it } from 'vitest';
import { viewToMat3 } from './viewToMat3';

describe('viewToMat3', () => {
  it('identity view → identity mat3', () => {
    expect(Array.from(viewToMat3({ x: 0, y: 0, scale: { x: 1, y: 1 } }))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('view {x:10, y:20, scale: { x: 2, y: 2 }} → translate(-20,-40) then scale(2) (column-major)', () => {
    const m = viewToMat3({ x: 10, y: 20, scale: { x: 2, y: 2 } });
    expect(Array.from(m)).toEqual([2, 0, 0, 0, 2, 0, -20, -40, 1]);
  });
});
