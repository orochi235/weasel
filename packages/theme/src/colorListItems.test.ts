import { describe, expect, it } from 'vitest';
import { colorCount, colorItemAt, generatedPaletteCount } from './colorListItems';

describe('generated color lists', () => {
  it('keeps a bounded number of generated palettes however many counts are asked for', () => {
    for (let count = 1; count <= 40; count++) colorItemAt({ generate: { count } }, 0);
    expect(generatedPaletteCount()).toBeLessThanOrEqual(16);
  });

  it('counts the colors colorAt wraps over, not the count asked for', () => {
    const list = { generate: { count: 2.5 } };
    expect(colorCount(list)).toBe(2);
    expect(colorItemAt(list, 2)).toBe(colorItemAt(list, 0));
  });
});
