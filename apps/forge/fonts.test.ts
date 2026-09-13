import { describe, expect, it } from 'vitest';
import { FONT_GLOBALS, fontRule } from './fonts';

describe('fontRule', () => {
  it('declares Storybook’s defaults, snapped to what Oswald ships', () => {
    expect(fontRule({})).toBe(
      ':root { font-family: Oswald, system-ui, sans-serif; font-weight: 400; font-stretch: normal; font-style: normal; }',
    );
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
