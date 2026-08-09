import { describe, it, expect } from 'vitest';
import { defineTheme, weaselTheme } from './theme';
import { resolveTheme } from './resolveTheme';

describe('resolveTheme', () => {
  it('resolves the built-in theme per mode', () => {
    expect(resolveTheme(weaselTheme, 'dark')['--wzl-surface']).toBe('#181a1e');
    expect(resolveTheme(weaselTheme, 'light')['--wzl-surface']).toBe('#f5f5f6');
  });

  it('rebases aliases when a base primitive is overridden', () => {
    const acme = defineTheme({ name: 'acme', tokens: { 'accent-base': '#ff0000' }, modes: {} });
    expect(resolveTheme(acme, 'dark')['--wzl-accent']).toBe('#ff0000');
  });

  it('inherits every unspecified token from the base', () => {
    const acme = defineTheme({ name: 'acme', modes: {} });
    expect(resolveTheme(acme, 'dark')['--wzl-radius-md']).toBe('5px');
  });

  it('lets a mode layer win over mode-invariant tokens', () => {
    const acme = defineTheme({
      name: 'acme',
      tokens: { surface: '#111111' },
      modes: { light: { surface: '#eeeeee' } },
    });
    expect(resolveTheme(acme, 'light')['--wzl-surface']).toBe('#eeeeee');
    expect(resolveTheme(acme, 'dark')['--wzl-surface']).toBe('#111111');
  });

  it('falls back to defaultMode for an unknown mode', () => {
    expect(resolveTheme(weaselTheme, 'nope')['--wzl-surface']).toBe('#181a1e');
  });

  it('throws naming the token when a theme opts out of the base and is incomplete', () => {
    const bare = defineTheme({ name: 'bare', extends: null, modes: { dark: { fg: '{color.nope}' } } });
    expect(() => resolveTheme(bare, 'dark')).toThrow(/nope/);
  });
});
