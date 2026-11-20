import { describe, it, expect } from 'vitest';
import { paintWithColor, solid, solidFill } from './paintDefaults';

describe('solid', () => {
  it('moves a short hex alpha channel to opacity', () => {
    expect(solid('#f008')).toEqual({ color: '#ff0000', opacity: 0x88 / 255 });
  });

  it('moves a long hex alpha channel to opacity, and leaves an opaque color alone', () => {
    expect(solid('#ff000080')).toEqual({ color: '#ff0000', opacity: 0x80 / 255 });
    expect(solid('#ff0000')).toEqual({ color: '#ff0000' });
    expect(solid('#f00')).toEqual({ color: '#f00' });
  });

  it('moves the alpha of a functional or named color to opacity', () => {
    expect(solid('rgba(255, 0, 0, 0.5)')).toEqual({ color: '#ff0000', opacity: 0.5 });
    expect(solid('hsl(0 100% 50% / 25%)')).toEqual({ color: '#ff0000', opacity: 0.25 });
    expect(solid('transparent')).toEqual({ color: '#000000', opacity: 0 });
    expect(solid('rgb(255, 0, 0)')).toEqual({ color: 'rgb(255, 0, 0)' });
    expect(solid('var(--ink)')).toEqual({ color: 'var(--ink)' });
  });
});

describe('paintWithColor', () => {
  it("lets a short hex alpha channel win over the paint's opacity", () => {
    expect(paintWithColor({ color: '#000', opacity: 0.5 }, '#f008')).toEqual({ color: '#ff0000', opacity: 0x88 / 255 });
  });

  it("lets a functional color's alpha win over the paint's opacity", () => {
    expect(paintWithColor({ color: '#000', opacity: 0.5 }, 'rgba(0, 0, 0, 0.5)')).toEqual({ color: '#000000', opacity: 0.5 });
    expect(paintWithColor({ color: '#000', opacity: 0.5 }, 'rgb(0, 0, 0)')).toEqual({ color: 'rgb(0, 0, 0)', opacity: 0.5 });
  });
});

describe('solidFill', () => {
  it('wraps the color in a tagged solid paint, moving a hex alpha channel to opacity', () => {
    expect(solidFill('#f00')).toEqual({ paint: { kind: 'solid', color: '#f00' } });
    expect(solidFill('#ff000080')).toEqual({ paint: { kind: 'solid', color: '#ff0000', opacity: 0x80 / 255 } });
  });
});
