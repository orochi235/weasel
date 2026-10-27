import { describe, expect, it } from 'vitest';
import { arrowMove, arrowSteps, keyMoveOf } from './arrowKeys';

const key = (k: string, shiftKey = false) => ({ key: k, shiftKey });

describe('arrow-key steps', () => {
  it('takes one step, or ten with shift, positive toward right and up', () => {
    expect(arrowSteps(key('ArrowRight'))).toBe(1);
    expect(arrowSteps(key('ArrowUp', true))).toBe(10);
    expect(arrowSteps(key('ArrowDown'))).toBe(-1);
    expect(arrowSteps(key('PageUp'))).toBeNull();
  });

  it('adds the Page keys and the ends for a slider', () => {
    expect(keyMoveOf(key('PageDown'))).toBe(-10);
    expect(keyMoveOf(key('Home'))).toBe('home');
    expect(keyMoveOf(key('ArrowLeft', true))).toBe(-10);
    expect(keyMoveOf(key('a'))).toBeNull();
  });

  it('right to left, mirrors only the horizontal arrows', () => {
    expect(keyMoveOf(key('ArrowRight'), 'rtl')).toBe(-1);
    expect(keyMoveOf(key('ArrowLeft', true), 'rtl')).toBe(10);
    expect(keyMoveOf(key('ArrowUp'), 'rtl')).toBe(1);
    expect(keyMoveOf(key('PageDown'), 'rtl')).toBe(-10);
    expect(keyMoveOf(key('End'), 'rtl')).toBe('end');
  });

  it('moves on a plane in screen axes', () => {
    expect(arrowMove(key('ArrowUp'))).toEqual({ dx: 0, dy: -1 });
    expect(arrowMove(key('ArrowLeft', true))).toEqual({ dx: -10, dy: 0 });
    expect(arrowMove(key('End'))).toBeNull();
  });
});
