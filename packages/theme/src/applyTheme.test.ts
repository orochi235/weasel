import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    applyTheme(el, weaselTheme, { mode: 'light' });
    expect(el.getAttribute('data-wzl-theme')).toBe('weasel');
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('leaves out a token value that would end its declaration or rule, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hostile = defineTheme({
      name: 'hostile',
      pins: {
        'font-ui': 'serif; } * { color: red',
        'font-mono': "'Courier New, monospace",
        'font-body': "'A;{}' , serif",
      },
    });
    const warned = () => warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('"hostile"'));
    applyTheme(document.createElement('div'), hostile, { mode: 'dark' });
    const once = warned();
    applyTheme(document.createElement('div'), hostile, { mode: 'dark' });
    const css = readSheetText();
    expect(css).not.toContain('color: red');
    expect(css).not.toContain('--wzl-font-ui:');
    expect(css).not.toContain('--wzl-font-mono:');
    expect(css).toMatch(/--wzl-font-body: *['"]A;{}['"] *, *serif/);
    expect(once.some((m) => m.includes('--wzl-font-ui,'))).toBe(true);
    expect(once.some((m) => m.includes('--wzl-font-mono,'))).toBe(true);
    expect(warned()).toEqual(once);
    warn.mockRestore();
  });

  it('leaves out a value that opens a comment, breaks a string, or escapes its own semicolon, keeping every other rule', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hostile = [
      ['comment', 'serif /*'],
      ['newline', "'a\n;} * { color: red } '"],
      ['escape', 'serif \\'],
    ];
    for (const [name, value] of hostile) {
      applyTheme(document.createElement('div'), defineTheme({ name, pins: { 'font-ui': value, 'accent-base': '#ff0000' } }), { mode: 'dark' });
    }
    applyTheme(document.createElement('div'), defineTheme({ name: 'plain', pins: { 'accent-base': '#0000ff' } }), { mode: 'dark' });
    const rules = [...document.adoptedStyleSheets, ...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
    expect(rules.map((r) => /data-wzl-theme=['"]?(\w+)/.exec(r.selectorText)?.[1]).sort()).toEqual(['comment', 'escape', 'newline', 'plain']);
    for (const rule of rules) {
      if (!rule.selectorText.includes('plain')) expect(rule.style.getPropertyValue('--wzl-font-ui')).toBe('');
      expect(rule.style.getPropertyValue('--wzl-accent').trim()).not.toBe('');
    }
    warn.mockRestore();
  });

  it('writes no inline custom properties', () => {
    const el = document.createElement('div');
    applyTheme(el, weaselTheme, { mode: 'light' });
    expect(el.getAttribute('style')).toBeNull();
  });

  it('emits one rule block per (theme, mode) pair, not per call', () => {
    applyTheme(document.createElement('div'), weaselTheme, { mode: 'light' });
    applyTheme(document.createElement('div'), weaselTheme, { mode: 'light' });
    applyTheme(document.createElement('div'), weaselTheme, { mode: 'light' });
    const hits = readSheetText().match(/data-wzl-theme="?'?weasel/g) ?? [];
    expect(hits).toHaveLength(1);
  });

  it('emits a distinct block for a custom theme', () => {
    const acme = defineTheme({ name: 'acme', pins: { 'accent-base': '#ff0000' } });
    applyTheme(document.createElement('div'), acme, { mode: 'dark' });
    const text = readSheetText();
    expect(text).toMatch(/data-wzl-theme="?'?acme/);
    expect(text).toContain('--wzl-accent: #ff0000');
  });

  it('writes a rule that matches its element when the theme name holds a quote or a backslash', () => {
    const el = document.createElement('div');
    document.body.append(el);
    applyTheme(el, defineTheme({ name: "bob's \\ theme", pins: { 'accent-base': '#ff0000' } }), { mode: 'dark' });
    const rules = [...document.adoptedStyleSheets, ...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
    expect(rules.some((r) => r.selectorText !== undefined && el.matches(r.selectorText))).toBe(true);
    el.remove();
  });

  it("writes the selected axis value's color scheme, as the stylesheet does", () => {
    const sepia = defineTheme({ name: 'sepia', axes: { mode: { default: 'dark', values: { sepia: { scheme: 'light' } } } } });
    applyTheme(document.createElement('div'), sepia, { mode: 'sepia' });
    expect(readSheetText()).toContain('color-scheme: light');
  });

  it('re-emits when a theme is redefined under the same name', () => {
    // `defineTheme` takes a caller-supplied name and enforces no uniqueness,
    // so an edit-and-reload (HMR, a theme editor) produces a new Theme with
    // the same name. Caching on the name alone would pin the first tokens.
    const el = document.createElement('div');
    const first = defineTheme({
      name: 'app',
      pins: { 'color-accent': '#111111' },
    });
    applyTheme(el, first, { mode: 'light' });
    expect(readSheetText()).toContain('#111111');

    const second = defineTheme({
      name: 'app',
      pins: { 'color-accent': '#222222' },
    });
    applyTheme(el, second, { mode: 'light' });
    expect(readSheetText()).toContain('#222222');
  });

  it('emits once for a theme applied repeatedly', () => {
    const el = document.createElement('div');
    const theme = defineTheme({ name: 'stable', pins: { 'color-accent': '#333333' } });
    applyTheme(el, theme, { mode: 'light' });
    applyTheme(el, theme, { mode: 'light' });
    applyTheme(el, theme, { mode: 'light' });
    const hits = readSheetText().split('#333333').length - 1;
    expect(hits).toBe(1);
  });

  it('stamps one attribute per axis and scopes the rule to all of them', () => {
    const dense = defineTheme({
      name: 'dense',
      axes: { density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
      pins: { gap: { by: 'density', comfortable: '4px', compact: '3px' } },
    });
    const el = document.createElement('div');
    applyTheme(el, dense, { mode: 'light', density: 'compact' });
    expect(el.getAttribute('data-wzl-density')).toBe('compact');
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
    expect(readSheetText()).toMatch(/data-wzl-theme=["']dense["']\]\[data-wzl-mode=["']light["']\]\[data-wzl-density=["']compact["']\]/);
    expect(readSheetText()).toContain('--wzl-gap: 3px');
  });
});
