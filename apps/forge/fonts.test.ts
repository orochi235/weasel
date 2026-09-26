import { describe, expect, it } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { FONT_GLOBALS, fontRule, fontTheme } from './fonts';

describe('fontRule', () => {
  it('declares Storybook’s defaults, snapped to what Oswald ships', () => {
    expect(fontRule({})).toContain(
      'font-family: Oswald, system-ui, sans-serif; font-weight: 400; font-stretch: normal; font-style: normal;',
    );
  });

  it('points weasel’s default face at the chosen family, and leaves a slot on Theme alone', () => {
    const rule = fontRule({ fontFamily: 'helvetica' });
    expect(rule).toContain('--wzl-font-ui: "Helvetica Neue", Helvetica, Arial, sans-serif;');
    for (const face of ['display', 'body', 'mono']) expect(rule).not.toContain(`--wzl-font-${face}`);
  });

  it('points each other slot at the family its own global picks', () => {
    const rule = fontRule({ fontDisplay: 'lato', fontBody: 'inter', fontMono: 'jetbrains' });
    expect(rule).toContain('--wzl-font-display: Lato, system-ui, sans-serif;');
    expect(rule).toContain('--wzl-font-body: Inter, system-ui, sans-serif;');
    expect(rule).toContain('--wzl-font-mono: "JetBrains Mono", ui-monospace, monospace;');
  });

  it('declares the font tokens on a selector that outranks the theme’s own [data-wzl-theme][data-wzl-mode] rule', () => {
    expect(fontRule({})).toMatch(/\[data-wzl-theme\]\[data-wzl-mode\]\[data-wzl-mode\][^{]*\{[^}]*--wzl-font-ui:/);
  });

  it('has form controls inherit the font, which they do not by default', () => {
    expect(fontRule({})).toContain(':root :where(button, input, select, textarea) { font: inherit; }');
  });

  it('snaps a weight to the nearest the font ships, the lighter on a tie', () => {
    expect(fontRule({ fontFamily: 'helvetica', fontWeight: '600' })).toContain('font-weight: 500;');
    expect(fontRule({ fontFamily: 'ptSans', fontWeight: '900' })).toContain('font-weight: 700;');
  });

  it('snaps a width to the nearest the font ships', () => {
    expect(fontRule({ fontFamily: 'helvetica', fontStretch: 'condensed' })).toContain('font-stretch: condensed;');
    expect(fontRule({ fontFamily: 'futura', fontStretch: 'ultra-condensed' })).toContain('font-stretch: condensed;');
    expect(fontRule({ fontFamily: 'inter', fontStretch: 'condensed' })).toContain('font-stretch: normal;');
  });

  it('turns italic off for a font with no italic face', () => {
    expect(fontRule({ fontFamily: 'inter', fontStyle: 'italic' })).toContain('font-style: italic;');
    expect(fontRule({ fontFamily: 'oswald', fontStyle: 'italic' })).toContain('font-style: normal;');
  });

  it('uses Oswald for a family it does not know', () => {
    expect(fontRule({ fontFamily: 'comic' })).toContain('font-family: Oswald, system-ui, sans-serif;');
  });
});

describe('FONT_GLOBALS', () => {
  it('declares a family per slot, weight, width and italic, each defaulting to one of its own options', () => {
    expect(Object.fromEntries(Object.entries(FONT_GLOBALS).map(([key, d]) => [key, d.default]))).toEqual({
      fontFamily: 'oswald',
      fontDisplay: 'theme',
      fontBody: 'theme',
      fontMono: 'theme',
      fontWeight: '500',
      fontStretch: 'normal',
      fontStyle: 'normal',
    });
    for (const declaration of Object.values(FONT_GLOBALS)) {
      expect(declaration.options.map((o) => o.value)).toContain(declaration.default);
    }
  });

  it('offers only the weights, widths and italic the chosen font ships', () => {
    const shown = (key: string, globals: Record<string, string>) =>
      FONT_GLOBALS[key]!.options.map((option) => option.value).filter((value) => FONT_GLOBALS[key]!.shows!(value, globals));
    expect(shown('fontStretch', { fontFamily: 'oswald' })).toEqual(['normal']);
    expect(shown('fontStretch', { fontFamily: 'futura' })).toEqual(['condensed', 'normal']);
    expect(shown('fontStyle', { fontFamily: 'oswald' })).toEqual(['normal']);
    expect(shown('fontStyle', { fontFamily: 'inter' })).toEqual(['normal', 'italic']);
    expect(shown('fontWeight', { fontFamily: 'oswald' })).toEqual(['200', '300', '400']);
  });
});

describe('fontTheme', () => {
  it('sets each slot to its chosen family, and leaves a slot on Theme alone', () => {
    const tokens = resolveTheme(fontTheme(weaselTheme, { fontFamily: 'inter', fontMono: 'jetbrains' }), { mode: 'light' });
    const base = resolveTheme(weaselTheme, { mode: 'light' });
    expect(tokens['--wzl-font-ui']).toMatch(/^Inter\b/);
    expect(tokens['--wzl-font-mono']).toMatch(/^['"]?JetBrains Mono/);
    for (const name of ['--wzl-font-display', '--wzl-font-body'] as const) expect(tokens[name]).toBe(base[name]);
  });

  it('keeps one theme per combination, so the lab is not handed a new theme for the same choice', () => {
    const globals = { fontFamily: 'inter', fontBody: 'lato' };
    expect(fontTheme(weaselTheme, globals)).toBe(fontTheme(weaselTheme, { ...globals }));
    expect(fontTheme(weaselTheme, globals).name).toBe('weasel-ui-inter-body-lato');
  });
});
