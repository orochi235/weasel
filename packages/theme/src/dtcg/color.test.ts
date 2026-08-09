import { describe, it, expect } from 'vitest';
import { hexToRgba } from './color';

describe('hexToRgba', () => {
  it('expands 6-digit hex', () => {
    expect(hexToRgba('#e6e7e9', 0.2)).toBe('rgba(230, 231, 233, 0.2)');
  });

  it('expands 3-digit shorthand', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('throws on a non-hex input rather than guessing', () => {
    expect(() => hexToRgba('rebeccapurple', 0.5)).toThrow(/hex/i);
  });
});
