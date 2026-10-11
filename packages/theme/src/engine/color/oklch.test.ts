import { describe, expect, it } from 'vitest';
import { hexToRgb, luminance, toLab } from './oklch';

describe('hex colors in the engine', () => {
  it('reads shorthand as the color it abbreviates', () => {
    expect(hexToRgb('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
    expect(luminance('#fff')).toBeCloseTo(1);
  });

  it('ignores the alpha of a four or eight digit hex', () => {
    expect(hexToRgb('#ff000080')).toEqual([255, 0, 0]);
    expect(toLab('#f008')).toEqual(toLab('#ff0000'));
  });

  it('throws on a color that is not hex, where it used to compute from NaN', () => {
    expect(() => luminance('tomato')).toThrow(/tomato/);
  });
});
