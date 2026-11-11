import { describe, expect, it } from 'vitest';
import { blendTheme } from './blendTheme';
import type { Theme } from './theme';

const theme = (axes: Theme['axes'], a: Theme['tokens'][string]): Theme => ({ name: 'x', extends: null, axes, tokens: { a } });
const dim = (value: string) => ({ type: 'dimension', value });

describe('blendTheme, shrunk counterexamples', () => {
  it('blends two lengths near the double range\'s end to a finite length', () => {
    const t = theme({ mode: { default: 'dark', values: { dark: {}, light: {} } } }, { by: 'mode', dark: dim('1e308px'), light: dim('1.5e308px') });
    expect(blendTheme(t, { mode: { dark: 1, light: 1 } })).toEqual({ '--wzl-a': '1.25e+308px' });
  });

  it('blends along two axes whose shares are too small to multiply', () => {
    const t = theme(
      { mode: { default: 'dark', values: { dark: {}, light: {} } }, density: { default: 'a', values: { a: {}, b: {} } } },
      { by: 'mode', dark: { by: 'density', a: dim('0px'), b: dim('4px') }, light: dim('8px') },
    );
    expect(blendTheme(t, { mode: { dark: 1e-200, light: 1e-200 }, density: { a: 1e-200, b: 1e-200 } })).toEqual({ '--wzl-a': '5px' });
  });

  it('blends shares whose sum is past the double range', () => {
    const t = theme({ mode: { default: 'dark', values: { dark: {}, light: {} } } }, { by: 'mode', dark: dim('0px'), light: dim('4px') });
    expect(blendTheme(t, { mode: { dark: 1e308, light: 1e308 } })).toEqual({ '--wzl-a': '2px' });
  });
});

describe('blendTheme, infinite shares', () => {
  const t = theme({ mode: { default: 'dark', values: { dark: {}, light: {}, dim: {} } } }, { by: 'mode', dark: dim('0px'), light: dim('4px'), dim: dim('8px') });

  it('gives an infinite share the whole axis, and splits it equally among several', () => {
    expect(blendTheme(t, { mode: { dark: Infinity, light: 5 } })).toEqual({ '--wzl-a': '0px' });
    expect(blendTheme(t, { mode: { dark: Infinity, light: 5, dim: Infinity } })).toEqual({ '--wzl-a': '4px' });
  });

  it('blends a length past 1e302 at a share near a million to a finite length', () => {
    const big = theme({ mode: { default: 'dark', values: { dark: {}, dim: {} } } }, { by: 'mode', dark: dim('1.797693134862319e+302px'), dim: dim('0px') });
    expect(blendTheme(big, { mode: { dark: 999999.9999999984, dim: 5e-324 } })).toEqual({ '--wzl-a': '1.797693134862319e+302px' });
  });
});
