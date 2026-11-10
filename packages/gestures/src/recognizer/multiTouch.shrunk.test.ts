import { describe, expect, it } from 'vitest';
import { multiTouchGeometry } from './multiTouch';

describe('multiTouchGeometry, from shrunk property counterexamples', () => {
  it('reports 180, never -180, for a second finger level with and left of the first', () => {
    expect(multiTouchGeometry([{ x: 0, y: 0 }, { x: -1, y: -0 }]).angle).toBe(180);
    expect(multiTouchGeometry([{ x: 0, y: 100.30000000000001 }, { x: -50, y: 100.3 }]).angle).toBe(180);
    expect(multiTouchGeometry([
      { x: 0, y: 7.186114295169753e-278 }, { x: -3.635911367637602e-278, y: 7.186114295169752e-278 }, { x: 0, y: 0 },
    ]).angle).toBe(180);
  });
});
