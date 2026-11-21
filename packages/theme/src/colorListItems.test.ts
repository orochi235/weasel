import { describe, expect, it } from 'vitest';
import { colorItemAt, generatedPaletteCount } from './colorListItems';

describe('generated color lists', () => {
  it('keeps a bounded number of generated palettes however many counts are asked for', () => {
    for (let count = 1; count <= 40; count++) colorItemAt({ generate: { count } }, 0);
    expect(generatedPaletteCount()).toBeLessThanOrEqual(16);
  });

});
