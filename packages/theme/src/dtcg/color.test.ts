import { describe, it, expect } from 'vitest';
import { withAlpha } from './color';

describe('withAlpha', () => {
  it('expands 6-digit hex', () => {
    expect(withAlpha('#e6e7e9', 0.2)).toBe('rgba(230, 231, 233, 0.2)');
  });

  it('expands 3-digit shorthand', () => {
    expect(withAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('multiplies into the alpha an 8-digit hex already carries', () => {
    expect(withAlpha('#ff000080', 0.5)).toBe('rgba(255, 0, 0, 0.251)');
  });

  it('multiplies into the alpha of an rgba() literal', () => {
    expect(withAlpha('rgba(20, 20, 36, 0.55)', 0.5)).toBe('rgba(20, 20, 36, 0.275)');
  });

  it('reads rgb() without an alpha as opaque', () => {
    expect(withAlpha('rgb(255, 255, 255)', 0.14)).toBe('rgba(255, 255, 255, 0.14)');
  });

  it('reads the space-separated rgb() syntax, alpha and percentages included', () => {
    expect(withAlpha('rgb(100% 0% 50% / 50%)', 0.5)).toBe('rgba(255, 0, 128, 0.25)');
  });

  it('keeps transparent transparent', () => {
    expect(withAlpha('transparent', 0.5)).toBe('rgba(0, 0, 0, 0)');
  });

  it('defers anything it cannot parse to color-mix(), which composes the same way', () => {
    expect(withAlpha('rebeccapurple', 0.5)).toBe('color-mix(in srgb, rebeccapurple 50%, transparent)');
    expect(withAlpha('oklch(0.7 0.1 250)', 0.07)).toBe('color-mix(in srgb, oklch(0.7 0.1 250) 7%, transparent)');
  });
});
