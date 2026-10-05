import { describe, expect, it } from 'vitest';
import { resolveCurrentColor } from './currentColor';
import { resolveTheme } from './resolveTheme';
import { weaselTheme } from './theme';

describe('resolveCurrentColor', () => {
  it('leaves a value that never mentions currentColor alone', () => {
    expect(resolveCurrentColor('#25272c', '#e6e7e9')).toBe('#25272c');
  });

  it('takes bare currentColor to be the current color', () => {
    expect(resolveCurrentColor('currentColor', '#e6e7e9')).toBe('#e6e7e9');
  });

  it('replaces the alpha for a relative color, rather than multiplying into it', () => {
    expect(resolveCurrentColor('rgb(from currentColor r g b / 0.7)', 'rgba(230, 231, 233, 0.5)')).toBe('rgba(230, 231, 233, 0.7)');
    expect(resolveCurrentColor('rgb(from currentcolor r g b / 54%)', '#e6e7e9')).toBe('rgba(230, 231, 233, 0.54)');
  });

  it('multiplies into the alpha for a mix with transparent', () => {
    expect(resolveCurrentColor('color-mix(in oklab, currentColor 50%, transparent)', 'rgba(230, 231, 233, 0.5)')).toBe('rgba(230, 231, 233, 0.25)');
  });

  it('throws on a form it cannot flatten', () => {
    expect(() => resolveCurrentColor('color-mix(in oklab, currentColor 50%, red)', '#fff')).toThrow(/cannot flatten/);
  });

  it('flattens the built-in emphasis tokens against fg in both modes', () => {
    for (const mode of ['dark', 'light']) {
      const t = resolveTheme(weaselTheme, { mode });
      for (const name of ['--wzl-fg-muted', '--wzl-fg-subtle', '--wzl-stance-aside-title-color'] as const) {
        expect(resolveCurrentColor(t[name], t['--wzl-fg'])).toMatch(/^rgba\(\d+, \d+, \d+, 0\.\d+\)$/);
      }
    }
  });
});
