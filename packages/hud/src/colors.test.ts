import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { hudColor } from './colors';

const resolved = resolveTheme(weaselTheme, { mode: 'dark' });
const color = hudColor({ theme: weaselTheme, resolved, tints: ['#111111', '#222222'] });

describe('hudColor', () => {
  it('resolves a source to a hex against the theme and tint list it is given', () => {
    expect(color({ ref: 'accent' })).toBe(resolved['--wzl-accent']);
    expect(color({ ref: 'tint', index: 3 })).toBe('#222222');
    expect(color({ space: 'srgb', coords: [1, 0, 0] })).toBe('#ff0000');
  });

  it('answers undefined for a source nothing resolves', () => {
    expect(color({ ref: 'nope' })).toBeUndefined();
    expect(color({ ref: '--mine' })).toBeUndefined();
  });
});
