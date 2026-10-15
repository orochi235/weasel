import { interpolateSrgb, parseColor, rgbaToHex } from '@weasel-js/paint';
import { afterEach, describe, expect, it } from 'vitest';
import { __resetThemeSheet, applyTheme } from './applyTheme';
import { blendTheme } from './blendTheme';
import { resolveTheme } from './resolveTheme';
import { defineTheme, weaselTheme } from './theme';

const dark = resolveTheme(weaselTheme, { mode: 'dark' });
const light = resolveTheme(weaselTheme, { mode: 'light' });

describe('blendTheme', () => {
  it('is the theme resolved where one value holds all the weight', () => {
    expect(blendTheme(weaselTheme, { mode: { light: 1 } })).toEqual(light);
    expect(blendTheme(weaselTheme, {}, { mode: 'light' })).toEqual(light);
  });

  it('mixes a color in OKLCH from what each mode resolves it to', () => {
    const a = parseColor(dark['--wzl-surface']);
    const b = parseColor(light['--wzl-surface']);
    const [r, g, bl] = interpolateSrgb([a[0], a[1], a[2]], [b[0], b[1], b[2]], 0.25, 'oklch');
    expect(blendTheme(weaselTheme, { mode: { dark: 0.75, light: 0.25 } })['--wzl-surface']).toBe(rgbaToHex([r, g, bl, 1]));
  });

  it('mixes a number in its unit, across two axes at once', () => {
    const at = (density: string): number => Number.parseFloat(resolveTheme(weaselTheme, { density })['--wzl-control-h']);
    const half = blendTheme(weaselTheme, { density: { compact: 1, roomy: 1 }, mode: { dark: 1, light: 1 } });
    expect(half['--wzl-control-h']).toBe(`${(at('compact') + at('roomy')) / 2}px`);
  });

  it('leaves a token both modes agree on as written, and gives one that cannot mix the heaviest', () => {
    const half = blendTheme(weaselTheme, { mode: { dark: 0.4, light: 0.6 } });
    expect(half['--wzl-font-mono']).toBe(dark['--wzl-font-mono']);
    expect(half['--wzl-gray-50']).toBe(dark['--wzl-gray-50']);
    const theme = defineTheme({ name: 'x', pins: { backdrop: { by: 'mode', dark: 'none', light: 'linear-gradient(red, blue)' } } });
    expect(blendTheme(theme, { mode: { dark: 0.4, light: 0.6 } })['--wzl-backdrop']).toBe('linear-gradient(red, blue)');
  });

  it('blends an alias in one mode with a literal in the other like any two colors', () => {
    const theme = defineTheme({ name: 'x', pins: { surface: { by: 'mode', dark: '{gray-900}', light: '#ffffff' } } });
    const mid = blendTheme(theme, { mode: { dark: 1, light: 1 } })['--wzl-surface'];
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
    expect(mid).not.toBe('#ffffff');
    expect(mid).not.toBe(dark['--wzl-gray-900']);
  });

  it('ignores an axis the theme lacks and a value the axis lacks', () => {
    expect(blendTheme(weaselTheme, { contrast: { high: 1 }, mode: { sepia: 1 } })).toEqual(dark);
  });
});

describe('applyTheme with weights', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.adoptedStyleSheets = [];
    __resetThemeSheet();
  });

  it('holds the blend under the selection’s attributes, and replaces it on the next step', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const css = (): string =>
      (document.adoptedStyleSheets ?? []).flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join('\n')
      + (document.getElementById('wzl-themes')?.textContent ?? '');
    const weights = { mode: { dark: 0.5, light: 0.5 } };
    applyTheme(el, weaselTheme, { mode: 'light' }, { weights });
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
    expect(css()).toContain(`--wzl-surface: ${blendTheme(weaselTheme, weights)['--wzl-surface']}`);
    applyTheme(el, weaselTheme, { mode: 'light' });
    expect(css()).toContain(`--wzl-surface: ${light['--wzl-surface']}`);
    expect(css()).not.toContain(blendTheme(weaselTheme, weights)['--wzl-surface']);
    el.remove();
  });
});
