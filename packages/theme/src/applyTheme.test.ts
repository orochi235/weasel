import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { defineTheme, weaselTheme } from './theme';

/** Read whichever delivery mechanism applyTheme chose. */
function readSheetText(): string {
  const adopted = (document.adoptedStyleSheets ?? [])
    .flatMap((s) => [...s.cssRules].map((r) => r.cssText))
    .join('\n');
  const styleEl = document.getElementById('wzl-themes')?.textContent ?? '';
  return adopted + styleEl;
}

describe('applyTheme', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.adoptedStyleSheets = [];
    __resetThemeSheet();
  });

  it('stamps the theme and mode attributes', () => {
    const el = document.createElement('div');
    applyTheme(el, weaselTheme, 'light');
    expect(el.getAttribute('data-wzl-theme')).toBe('weasel');
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('writes no inline custom properties', () => {
    const el = document.createElement('div');
    applyTheme(el, weaselTheme, 'light');
    expect(el.getAttribute('style')).toBeNull();
  });

  it('emits one rule block per (theme, mode) pair, not per call', () => {
    applyTheme(document.createElement('div'), weaselTheme, 'light');
    applyTheme(document.createElement('div'), weaselTheme, 'light');
    applyTheme(document.createElement('div'), weaselTheme, 'light');
    const hits = readSheetText().match(/data-wzl-theme="?'?weasel/g) ?? [];
    expect(hits).toHaveLength(1);
  });

  it('emits a distinct block for a custom theme', () => {
    const acme = defineTheme({ name: 'acme', tokens: { 'accent-base': '#ff0000' }, modes: {} });
    applyTheme(document.createElement('div'), acme, 'dark');
    const text = readSheetText();
    expect(text).toMatch(/data-wzl-theme="?'?acme/);
    expect(text).toContain('--wzl-accent: #ff0000');
  });

  it('re-emits when a theme is redefined under the same name', () => {
    // `defineTheme` takes a caller-supplied name and enforces no uniqueness,
    // so an edit-and-reload (HMR, a theme editor) produces a new Theme with
    // the same name. Caching on the name alone would pin the first tokens.
    const el = document.createElement('div');
    const first = defineTheme({
      name: 'app',
      modes: { light: { 'color-accent': '#111111' } },
    });
    applyTheme(el, first, 'light');
    expect(readSheetText()).toContain('#111111');

    const second = defineTheme({
      name: 'app',
      modes: { light: { 'color-accent': '#222222' } },
    });
    applyTheme(el, second, 'light');
    expect(readSheetText()).toContain('#222222');
  });

  it('emits once for a theme applied repeatedly', () => {
    const el = document.createElement('div');
    const theme = defineTheme({ name: 'stable', modes: { light: { 'color-accent': '#333333' } } });
    applyTheme(el, theme, 'light');
    applyTheme(el, theme, 'light');
    applyTheme(el, theme, 'light');
    const hits = readSheetText().split('#333333').length - 1;
    expect(hits).toBe(1);
  });
});
