import { describe, expect, it } from 'vitest';
import { cycleFill, DEFAULT_PALETTE, GHOST_STROKE } from './paint';

describe('cycleFill', () => {
  it('walks the default palette in order and wraps', () => {
    expect([0, 1, 2, 3, 4, 5, -1].map((i) => cycleFill(i))).toEqual([
      '#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a', '#7fb069', '#d47a7a',
    ]);
    expect(GHOST_STROKE).toBe('#7fb069');
  });

  it('resolves refs and falls back for a color with no hex form', () => {
    const palette = {
      entries: [
        { name: 'base', color: { space: 'oklch', coords: [1, 0, 0] } },
        { name: 'alias', color: { ref: 'base' } },
        { name: 'wide', color: { space: 'display-p3', coords: [1, 0, 0] } },
      ],
    };
    expect(cycleFill(1, palette)).toBe('#ffffff');
    expect(cycleFill(2, palette, '#000000')).toBe('#000000');
    expect(DEFAULT_PALETTE.entries).toHaveLength(5);
  });
});
