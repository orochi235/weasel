import { describe, expect, it } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { wzlAttr, wzlValue } from './axes';
import type { Theme } from './theme';

describe('wzlAttr, shrunk counterexamples', () => {
  it('escapes a carriage return and a form feed, which end a CSS string as a newline does', () => {
    expect(wzlAttr('theme', '\r')).toBe("[data-wzl-theme='\\d ']");
    expect(wzlAttr('theme', 'a\fb')).toBe("[data-wzl-theme='a\\c b']");
    const el = document.createElement('div');
    el.setAttribute('data-wzl-theme', 'a\r\nb');
    expect(el.matches(wzlAttr('theme', 'a\r\nb'))).toBe(true);
  });

  it('writes a NUL as U+FFFD in both the attribute and the selector, so a NUL-named theme applies', () => {
    expect(wzlValue('a\0b')).toBe('a�b');
    expect(wzlAttr('theme', '\0')).toBe("[data-wzl-theme='�']");
    document.adoptedStyleSheets = [];
    __resetThemeSheet();
    const el = document.body.appendChild(document.createElement('div'));
    const theme: Theme = { name: 'n\0', extends: null, axes: { mode: { default: 'd\0', values: { 'd\0': {} } } }, tokens: { x: { type: 'unknown', value: '4px' } } };
    const release = applyTheme(el, theme);
    expect(el.getAttribute('data-wzl-theme')).toBe('n�');
    expect(el.getAttribute('data-wzl-mode')).toBe('d�');
    const rules = [...document.adoptedStyleSheets, ...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
    const mine = rules.filter((r) => el.matches(r.selectorText));
    expect(mine.map((r) => r.style.getPropertyValue('--wzl-x').trim())).toEqual(['4px']);
    release();
    el.remove();
  });
});
