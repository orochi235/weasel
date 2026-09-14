import { describe, expect, it } from 'vitest';
import { themeAxes } from './resolveTheme';
import { defineTheme, weaselTheme } from './theme';

describe('defineTheme', () => {
  it('defaults to extending the built-in theme', () => {
    const t = defineTheme({ name: 'acme' });
    expect(t.extends).toBe(weaselTheme);
    expect(themeAxes(t).mode.default).toBe('dark');
  });

  it('normalizes a bare pin', () => {
    const t = defineTheme({ name: 'acme', pins: { 'accent-base': '#ff0000' } });
    expect(t.tokens['accent-base']).toEqual({ type: 'unknown', value: '#ff0000', alpha: undefined, description: undefined });
  });

  it('keeps a pin that varies by mode', () => {
    const t = defineTheme({ name: 'acme', pins: { surface: { by: 'mode', light: '#eeeeee' } } });
    expect(t.tokens.surface).toEqual({ by: 'mode', light: { type: 'unknown', value: '#eeeeee', alpha: undefined, description: undefined } });
  });

  it('refuses a definition name as extends, and says to pass the Theme', () => {
    expect(() => defineTheme({ name: 'x', extends: 'weasel' as never })).toThrow(
      'Theme "x" extends "weasel" by name; defineTheme needs the Theme itself (e.g. weaselTheme), not a definition\'s name.',
    );
  });

  it('can opt out of the base entirely', () => {
    expect(defineTheme({ name: 'bare', extends: null }).extends).toBeNull();
  });

  it('refuses a definition that needs deriving, and names the engine', () => {
    expect(() => defineTheme({ name: 'x', ramps: { gray: { kind: 'lightness', steps: ['a'], lightness: [0.5, 0.5] } } })).toThrow(
      /@weasel-js\/theme\/engine/,
    );
  });

  it('exposes the built-in theme with both modes', () => {
    expect(Object.keys(weaselTheme.axes.mode.values).sort()).toEqual(['dark', 'light']);
  });
});
