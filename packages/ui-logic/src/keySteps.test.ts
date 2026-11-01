import { describe, expect, it } from 'vitest';
import { arrowMove, arrowSteps, rangeKey } from './keySteps';

describe('arrow-key steps', () => {
  it('takes one step, or ten with shift, positive toward right and up', () => {
    expect(arrowSteps('ArrowRight', false)).toBe(1);
    expect(arrowSteps('ArrowUp', true)).toBe(10);
    expect(arrowSteps('ArrowDown', false)).toBe(-1);
    expect(arrowSteps('PageUp', false)).toBeNull();
  });

  it('adds the Page keys and the ends along a range', () => {
    expect(rangeKey('PageDown', false)).toBe(-10);
    expect(rangeKey('Home', false)).toBe('home');
    expect(rangeKey('ArrowLeft', true)).toBe(-10);
    expect(rangeKey('a', false)).toBeNull();
  });

  it('right to left, mirrors only the horizontal arrows', () => {
    expect(rangeKey('ArrowRight', false, 'rtl')).toBe(-1);
    expect(rangeKey('ArrowLeft', true, 'rtl')).toBe(10);
    expect(rangeKey('ArrowUp', false, 'rtl')).toBe(1);
    expect(rangeKey('PageDown', false, 'rtl')).toBe(-10);
    expect(rangeKey('End', false, 'rtl')).toBe('end');
  });

  it('moves on a plane in screen axes', () => {
    expect(arrowMove('ArrowUp', false)).toEqual({ dx: 0, dy: -1 });
    expect(arrowMove('ArrowLeft', true)).toEqual({ dx: -10, dy: 0 });
    expect(arrowMove('End', false)).toBeNull();
  });
});
