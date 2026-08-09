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
});
