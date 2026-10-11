import { describe, expect, it } from 'vitest';
import { resolveTheme, themeAxes } from './resolveTheme';
import { defineTheme, weaselTheme } from './theme';

describe('resolveTheme', () => {
  it('resolves the built-in theme per mode', () => {
    expect(resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-surface']).toBe('#181a1e');
    expect(resolveTheme(weaselTheme, { mode: 'light' })['--wzl-surface']).toBe('#f5f5f6');
  });

  it('rebases aliases when a base primitive is overridden', () => {
    const acme = defineTheme({ name: 'acme', pins: { 'accent-base': '#ff0000' } });
    expect(resolveTheme(acme)['--wzl-accent']).toBe('#ff0000');
  });

  it('inherits every unspecified token from the base', () => {
    expect(resolveTheme(defineTheme({ name: 'acme' }))['--wzl-radius-md']).toBe('5px');
  });

  it('picks a varying pin per selection', () => {
    const acme = defineTheme({ name: 'acme', pins: { surface: { by: 'mode', dark: '#111111', light: '#eeeeee' } } });
    expect(resolveTheme(acme, { mode: 'light' })['--wzl-surface']).toBe('#eeeeee');
    expect(resolveTheme(acme, { mode: 'dark' })['--wzl-surface']).toBe('#111111');
  });

  it('falls through to the base where a by leaves a value out', () => {
    const acme = defineTheme({ name: 'acme', pins: { backdrop: { by: 'mode', dark: 'url(x.png)' } } });
    expect(resolveTheme(acme, { mode: 'dark' })['--wzl-backdrop']).toBe('url(x.png)');
    expect(resolveTheme(acme, { mode: 'light' })['--wzl-backdrop']).toBe('none');
  });

  it('keeps the parent’s values of an axis the child redeclares with fewer', () => {
    const dim = defineTheme({ name: 'dim', axes: { mode: { default: 'dim', values: { dim: {} } } }, pins: { surface: { by: 'mode', dim: '#333333' } } });
    expect(themeAxes(dim).mode).toEqual({ default: 'dim', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' }, dim: {} } });
    expect(resolveTheme(dim, { mode: 'light' })['--wzl-surface']).toBe('#f5f5f6');
    expect(resolveTheme(dim, { mode: 'dark' })['--wzl-surface']).toBe('#181a1e');
  });

  it('resolves a theme that adds a density, reading the base at its own default', () => {
    const big = defineTheme({ name: 'big', axes: { density: { default: 'comfortable', values: { huge: {} } } }, pins: {} });
    const base = resolveTheme(weaselTheme, { density: 'comfortable' });
    expect(resolveTheme(big, { density: 'huge' })).toEqual(base);
  });

  it('resolves a theme that adds a mode and makes it the default', () => {
    const sepia = defineTheme({
      name: 'sepia',
      axes: { mode: { default: 'sepia', values: { sepia: { scheme: 'light' } } } },
      pins: { 'gray-900': { by: 'mode', sepia: { type: 'color', value: '#f4ecd8' } } },
    });
    const resolved = resolveTheme(sepia);
    expect(Object.keys(resolved)).toEqual(Object.keys(resolveTheme(weaselTheme)));
    expect(resolved['--wzl-gray-900']).toBe('#f4ecd8');
    expect(resolved['--wzl-gray-800']).toBe(resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-gray-800']);
  });

  it('falls back to the default for an unknown axis value', () => {
    expect(resolveTheme(weaselTheme, { mode: 'nope' })['--wzl-surface']).toBe('#181a1e');
  });

  it('throws naming the token when a theme opts out of the base and is incomplete', () => {
    const bare = defineTheme({ name: 'bare', extends: null, pins: { fg: '{nope}' } });
    expect(() => resolveTheme(bare)).toThrow(/nope/);
  });
});
