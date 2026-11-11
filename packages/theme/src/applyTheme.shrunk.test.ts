/** Counterexamples `applyTheme.axes.pbt.test.ts` shrank to, kept as plain examples. */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { derive } from './engine/derive';
import { defineTheme } from './theme';
import type { Theme } from './theme';

const byMode: Theme = { name: 't', extends: null, axes: { mode: { default: 'dark', values: { dark: {} } } }, tokens: { y: { type: 'color', value: '#000001' } } };
const byDensity: Theme = { name: 't', extends: null, axes: { density: { default: 'roomy', values: { roomy: {} } } }, tokens: { y: { type: 'color', value: '#000000' } } };

describe('applyTheme again with other axes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.adoptedStyleSheets = [];
    __resetThemeSheet();
  });

  it('takes off the axis attributes the last application stamped and this one does not', () => {
    const el = document.body.appendChild(document.createElement('div'));
    applyTheme(el, byMode);
    applyTheme(el, byDensity);
    expect(el.hasAttribute('data-wzl-mode')).toBe(false);
    expect(el.getAttribute('data-wzl-density')).toBe('roomy');
  });

  it('so a rule another element holds for the theme it had is no longer its own', () => {
    const [a, b] = [0, 1].map(() => document.body.appendChild(document.createElement('div')));
    applyTheme(a!, byMode);
    applyTheme(a!, byDensity);
    applyTheme(b!, byMode);
    const rules = document.adoptedStyleSheets.flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
    expect(rules.filter((r) => a!.matches(r.selectorText)).map((r) => r.style.getPropertyValue('--wzl-y').trim())).toEqual(['#000000']);
  });
});

describe('axes named for the attributes applyTheme stamps itself', () => {
  it('refuses an axis named variant or theme, whose attribute would be overwritten and the theme not apply', () => {
    for (const axis of ['variant', 'theme']) {
      const axes = { [axis]: { default: 'a', values: { a: {} } } };
      expect(() => defineTheme({ name: 't', axes })).toThrow(`"${axis}" is reserved and cannot name an axis`);
      expect(derive({ name: 't', axes }).issues).toEqual([
        { kind: 'invalid', path: `axes.${axis}`, message: `"${axis}" is reserved and cannot name an axis: its data-wzl-${axis} attribute is the theme's own` },
      ]);
    }
  });
});
