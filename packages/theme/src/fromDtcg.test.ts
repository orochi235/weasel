import { describe, it, expect } from 'vitest';
import { fromDtcg } from './fromDtcg';
import { resolveTheme } from './resolveTheme';

describe('fromDtcg', () => {
  it('gives a mode named toString that the axes extension leaves out no scheme, not a built-in', () => {
    const theme = fromDtcg({
      name: 'acme',
      modes: { dark: { color: { $type: 'color', surface: { $value: '#000000' } } }, toString: { color: { $type: 'color', surface: { $value: '#ffffff' } } } },
      $extensions: { 'com.weasel.axes': { axes: { mode: { default: 'dark', values: { dark: { scheme: 'dark' } } } } } },
    });
    expect(Object.hasOwn(theme.axes.mode!.values, 'toString')).toBe(true);
    expect(theme.axes.mode!.values.toString).toEqual({});
    expect(resolveTheme(theme, { mode: 'toString' })['--wzl-surface']).toBe('#ffffff');
  });

  it('builds a Theme from a DTCG document', () => {
    const theme = fromDtcg({
      name: 'acme',
      defaultMode: 'dark',
      primitives: { color: { $type: 'color', 'accent-base': { $value: '#ff0000' } } },
      modes: { dark: { color: { $type: 'color', surface: { $value: '#000000' } } } },
    });
    expect(theme.name).toBe('acme');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-accent']).toBe('#ff0000');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-surface']).toBe('#000000');
  });

  it('falls through to the base theme’s other modes when the document declares one', () => {
    const theme = fromDtcg({ name: 'one', modes: { dark: { color: { $type: 'color', accent: { $value: '#ff0000' } } } } });
    expect(resolveTheme(theme, { mode: 'light' })['--wzl-surface']).toBe('#f5f5f6');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-accent']).toBe('#ff0000');
  });

  it('throws on a document with no name', () => {
    expect(() => fromDtcg({ primitives: {}, modes: {} })).toThrow(/name/i);
  });

  it('loads a document with no axes extension as mode-only, as before', () => {
    const theme = fromDtcg({
      name: 'plain',
      extends: null,
      defaultMode: 'light',
      primitives: { dimension: { $type: 'dimension', gap: { $value: '4px' } } },
      modes: {
        dark: { color: { $type: 'color', surface: { $value: '#000000' } } },
        light: { color: { $type: 'color', surface: { $value: '#ffffff' } } },
      },
    });
    expect(theme.axes).toEqual({ mode: { default: 'light', values: { dark: {}, light: {} } } });
    expect(theme.tokens).toEqual({
      gap: { type: 'dimension', value: '4px', alpha: undefined, description: undefined },
      surface: {
        by: 'mode',
        dark: { type: 'color', value: '#000000', alpha: undefined, description: undefined },
        light: { type: 'color', value: '#ffffff', alpha: undefined, description: undefined },
      },
    });
  });

  it('leaves a mode without a token named like an Object.prototype member to the base', () => {
    const theme = fromDtcg({
      name: 'proto',
      extends: null,
      modes: {
        dark: { color: { $type: 'color', constructor: { $value: '#000000' } } },
        light: { color: { $type: 'color', surface: { $value: '#ffffff' } } },
      },
    });
    expect(theme.tokens.constructor).toEqual({
      by: 'mode', dark: { type: 'color', value: '#000000', alpha: undefined, description: undefined },
    });
  });

  it('ignores an extension namespace it does not own', () => {
    const doc = { name: 'x', extends: null, primitives: { dimension: { $type: 'dimension', gap: { $value: '4px' } } } };
    const theme = fromDtcg({ ...doc, $extensions: { 'com.example.other': { anything: true } } });
    expect(theme).toEqual(fromDtcg(doc));
  });
});
