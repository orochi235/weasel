import { describe, it, expect, beforeEach } from 'vitest';
import { cachedFontVariant, getFont, resolveFontVariant, _resetFontRegistryForTests } from './registerFont';
import { registerTestFont } from './testing/registerTestFont';

beforeEach(() => {
  _resetFontRegistryForTests();
});

describe('cachedFontVariant', () => {
  it('hands back one frozen result per face for an exact match', async () => {
    await registerTestFont('inter', 400, 'normal');
    const a = cachedFontVariant('inter', 400, 'normal');
    expect(cachedFontVariant('inter', 400, 'normal')).toBe(a);
    expect(a).toEqual(resolveFontVariant('inter', 400, 'normal'));
    expect(Object.isFrozen(a) && Object.isFrozen(a.resolved) && Object.isFrozen(a.synthetic)).toBe(true);
  });

  it('follows a face registered again to its new entry', async () => {
    await registerTestFont('inter', 400, 'normal');
    const before = cachedFontVariant('inter', 400, 'normal');
    _resetFontRegistryForTests();
    await registerTestFont('inter', 400, 'normal');
    const after = cachedFontVariant('inter', 400, 'normal');
    expect(after.entry).toBe(getFont('inter', 400, 'normal'));
    expect(after.entry).not.toBe(before.entry);
  });

  it('resolves a fallback as resolveFontVariant does', async () => {
    await registerTestFont('inter', 400, 'normal');
    expect(cachedFontVariant('inter', 700, 'italic')).toEqual(resolveFontVariant('inter', 700, 'italic'));
  });
});

describe('resolveFontVariant', () => {
  it('returns a result of its own on every call, which the caller may change', async () => {
    await registerTestFont('inter', 400, 'normal');
    const a = resolveFontVariant('inter', 400, 'normal');
    expect(resolveFontVariant('inter', 400, 'normal')).not.toBe(a);
    a.synthetic.bold = true;
    expect(resolveFontVariant('inter', 400, 'normal').synthetic.bold).toBe(false);
    expect(cachedFontVariant('inter', 400, 'normal').synthetic.bold).toBe(false);
  });
});
