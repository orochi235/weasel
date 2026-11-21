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

  it('refuses a token name a custom property cannot carry, as derive does', () => {
    expect(() => defineTheme({ name: 'x', pins: { 'font size': '12px' } })).toThrow(/"font size" cannot name a token/);
    expect(() => defineTheme({ name: 'x', components: { 'a.b': '1px' } })).toThrow(/"a\.b" cannot name a token/);
  });

  it('exposes the built-in theme with both modes', () => {
    expect(Object.keys(weaselTheme.axes.mode.values).sort()).toEqual(['dark', 'light']);
  });

  it('refuses an axis whose default names none of its values, or its parent\'s', () => {
    expect(() => defineTheme({ name: 'x', axes: { density: { default: 'cozy', values: { compact: {} } } } })).toThrow(
      /axis "density" defaults to "cozy"/,
    );
    expect(() => defineTheme({ name: 'x', axes: { mode: { default: 'light', values: { dim: {} } } } })).not.toThrow();
  });

  it('refuses an axis name an attribute or selector cannot carry', () => {
    expect(() => defineTheme({ name: 'x', axes: { 'my axis': { default: 'a', values: { a: {} } } } })).toThrow(/"my axis" cannot name an axis/);
    expect(() => defineTheme({ name: 'x', axes: { 'a.b': { default: 'a', values: { a: {} } } } })).toThrow(/"a\.b" cannot name an axis/);
  });

  it('refuses a pin alpha outside 0 to 1', () => {
    expect(() => defineTheme({ name: 'x', pins: { line: { value: '{surface}', alpha: 1.5 } } })).toThrow(/alpha 1\.5 is not a number from 0 to 1/);
  });
});
