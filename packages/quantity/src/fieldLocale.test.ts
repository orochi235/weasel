import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultLocale, fieldLocale } from './fieldLocale';
import { decimal } from './kinds/plain';
import { parseAs, qty } from './present';
import { LOCALES } from './pbt.fixture';

describe('fieldLocale', () => {
  it('keeps every locale whose numbers read back as shown, non-Latin digits included', () => {
    for (const locale of LOCALES) expect(fieldLocale(locale)).toBe(locale);
  });

  it('is en-US for no locale and for a tag Intl refuses', () => {
    expect(fieldLocale()).toBe('en-US');
    expect(fieldLocale('')).toBe('en-US');
    expect(fieldLocale('not a locale!')).toBe('en-US');
  });
});

describe('defaultLocale', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is the browser's language, and what a number shows and reads in when no locale is asked for", () => {
    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(defaultLocale()).toBe('de-DE');
    expect(qty(1500.5, decimal()).text).toBe('1.500,5');
    expect(parseAs('1.500,5', decimal())).toBe(1500.5);
  });

  it('is en-US where there is no browser', () => {
    vi.stubGlobal('navigator', undefined);
    expect(defaultLocale()).toBe('en-US');
  });
});
