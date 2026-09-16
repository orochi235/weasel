import { describe, expect, it } from 'vitest';
import { FONT_GLOBALS, fontRule } from './fonts';

describe('fontRule', () => {
  it('declares Storybook’s defaults, snapped to what Oswald ships', () => {
    expect(fontRule({})).toContain(
      'font-family: Oswald, system-ui, sans-serif; font-weight: 400; font-stretch: normal; font-style: normal;',
    );
  });

  it('points weasel’s UI, display and body font tokens at the chosen family, and leaves mono alone', () => {
    const rule = fontRule({ fontFamily: 'helvetica' });
    const family = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    expect(rule).toContain(`--wzl-font-ui: ${family};`);
    expect(rule).toContain(`--wzl-font-display: ${family};`);
    expect(rule).toContain(`--wzl-font-body: ${family};`);
    expect(rule).not.toContain('--wzl-font-mono');
  });

  it('declares the font tokens on a selector that outranks the theme’s own [data-wzl-theme][data-wzl-mode] rule', () => {
    expect(fontRule({})).toMatch(/\[data-wzl-theme\]\[data-wzl-mode\]\[data-wzl-mode\][^{]*\{[^}]*--wzl-font-ui:/);
  });

  it('has form controls inherit the font, which they do not by default', () => {
    expect(fontRule({})).toContain(':where(button, input, select, textarea) { font: inherit; }');
  });

  it('snaps a weight to the nearest the font ships, the lighter on a tie', () => {
    expect(fontRule({ fontFamily: 'helvetica', fontWeight: '600' })).toContain('font-weight: 500;');
    expect(fontRule({ fontFamily: 'ptSans', fontWeight: '900' })).toContain('font-weight: 700;');
  });

  it('keeps a width the font ships, and otherwise falls back to normal', () => {
    expect(fontRule({ fontFamily: 'helvetica', fontStretch: 'condensed' })).toContain('font-stretch: condensed;');
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
  it('declares family, weight, width and italic with Storybook’s defaults, each one of its own options', () => {
    expect(Object.fromEntries(Object.entries(FONT_GLOBALS).map(([key, d]) => [key, d.default]))).toEqual({
      fontFamily: 'oswald',
      fontWeight: '500',
      fontStretch: 'normal',
      fontStyle: 'normal',
    });
    for (const declaration of Object.values(FONT_GLOBALS)) {
      expect(declaration.options.map((o) => o.value)).toContain(declaration.default);
    }
  });
});
