import { describe, expect, it } from 'vitest';
import { fieldLocale } from './fieldLocale';
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
