import { describe, expect, it } from 'vitest';
import { isPrimaryPress, pressButtonOf } from './pressButton';

describe('pressButtonOf', () => {
  it('names a mouse press by its button', () => {
    expect([0, 1, 2].map((button) => pressButtonOf({ button, pointerType: 'mouse' })))
      .toEqual(['primary', 'middle', 'secondary']);
  });

  it('leaves back and forward to the browser', () => {
    expect(pressButtonOf({ button: 3, pointerType: 'mouse' })).toBeNull();
    expect(pressButtonOf({ button: 4, pointerType: 'mouse' })).toBeNull();
  });

  it("presses a pen's eraser end like its tip, and its barrel button like a secondary one", () => {
    expect(pressButtonOf({ button: 5, pointerType: 'pen' })).toBe('primary');
    expect(pressButtonOf({ button: 2, pointerType: 'pen' })).toBe('secondary');
    expect(pressButtonOf({ button: 5, pointerType: 'mouse' })).toBeNull();
  });

  it('reads an absent button as primary', () => {
    expect(isPrimaryPress({})).toBe(true);
    expect(isPrimaryPress({ button: 0, pointerType: 'touch' })).toBe(true);
    expect(isPrimaryPress({ button: 2, pointerType: 'pen' })).toBe(false);
  });
});
