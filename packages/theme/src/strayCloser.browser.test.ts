import { afterEach, expect, test, vi } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { defineTheme } from './theme';

afterEach(() => { document.adoptedStyleSheets = []; __resetThemeSheet(); vi.restoreAllMocks(); });

const fontUi = (): string[] => document.adoptedStyleSheets
  .flatMap((s) => [...s.cssRules] as CSSStyleRule[])
  .map((r) => r.style.getPropertyValue('--wzl-font-ui').trim());

test.each(['serif)', 'serif ]'])('the browser drops a custom property holding %s, and applyTheme leaves it out', (value) => {
  expect(CSS.supports('--wzl-font-ui', value)).toBe(false);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  applyTheme(document.createElement('div'), defineTheme({ name: 'stray', pins: { 'font-ui': value } }), { mode: 'dark' });
  expect(fontUi()).toEqual(['']);
  expect(warn).toHaveBeenCalled();
});

test('the browser keeps a value whose brackets close, and so does applyTheme', () => {
  const value = "var(--a, [x] f(')'))";
  expect(CSS.supports('--wzl-font-ui', value)).toBe(true);
  applyTheme(document.createElement('div'), defineTheme({ name: 'closed', pins: { 'font-ui': value } }), { mode: 'dark' });
  expect(fontUi()).toEqual([value]);
});
