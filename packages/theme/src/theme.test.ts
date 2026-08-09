import { describe, it, expect } from 'vitest';
import { defineTheme, weaselTheme } from './theme';

describe('defineTheme', () => {
  it('defaults to extending the built-in theme', () => {
    const t = defineTheme({ name: 'acme', modes: {} });
    expect(t.extends).toBe(weaselTheme);
    expect(t.defaultMode).toBe('dark');
  });

  it('accepts a partial mode layer', () => {
    const t = defineTheme({ name: 'acme', modes: { dark: { 'accent-base': '#ff0000' } } });
    expect(t.modes.dark['accent-base']).toEqual({
      type: 'unknown', value: '#ff0000', alpha: undefined, description: undefined,
    });
  });

  it('accepts mode-invariant tokens', () => {
    const t = defineTheme({ name: 'acme', tokens: { 'radius-md': '9px' }, modes: {} });
    expect(t.tokens['radius-md'].value).toBe('9px');
  });

  it('can opt out of the base entirely', () => {
    const t = defineTheme({ name: 'bare', extends: null, modes: {} });
    expect(t.extends).toBeNull();
  });

  it('exposes the built-in theme with both modes', () => {
    expect(Object.keys(weaselTheme.modes).sort()).toEqual(['dark', 'light']);
  });
});
