import { describe, it, expect } from 'vitest';
import { paintWithColor, solid } from './paint';

describe('solid', () => {
  it('moves a short hex alpha channel to opacity', () => {
    expect(solid('#f008')).toEqual({ color: '#ff0000', opacity: 0x88 / 255 });
  });

  it('moves a long hex alpha channel to opacity, and leaves an opaque color alone', () => {
    expect(solid('#ff000080')).toEqual({ color: '#ff0000', opacity: 0x80 / 255 });
    expect(solid('#ff0000')).toEqual({ color: '#ff0000' });
    expect(solid('#f00')).toEqual({ color: '#f00' });
  });
});

describe('paintWithColor', () => {
  it("lets a short hex alpha channel win over the paint's opacity", () => {
    expect(paintWithColor({ color: '#000', opacity: 0.5 }, '#f008')).toEqual({ color: '#ff0000', opacity: 0x88 / 255 });
  });
});
