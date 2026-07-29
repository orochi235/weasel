import { describe, it, expect, beforeEach } from 'vitest';
import { resolveFontVariant, getFont, _resetFontRegistryForTests } from './registerFont';
import { setDefaultFontFamily, setFontFallbackPolicy, _resetFallbackForTests } from './fallback';
import { registerTestFont } from './testing/registerTestFont';

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
});

describe('substitute policy', () => {
  it('resolves an unregistered family to the default family', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBe(getFont('Inter', 400, 'normal'));
    expect(result.substituted).toEqual({ requested: 'Comic Sans', resolved: 'Inter' });
  });

  it('leaves substituted undefined when the requested family resolves', async () => {
    await registerTestFont('Inter', 400, 'normal');

    const result = resolveFontVariant('Inter', 400, 'normal');

    expect(result.entry).not.toBeNull();
    expect(result.substituted).toBeUndefined();
  });

  it('defaults the default family to the first registered family', async () => {
    await registerTestFont('Roboto', 400, 'normal');
    await registerTestFont('Inter', 400, 'normal');

    const result = resolveFontVariant('Nothing', 400, 'normal');

    expect(result.substituted).toEqual({ requested: 'Nothing', resolved: 'Roboto' });
  });

  it('returns a miss when no family is registered at all', () => {
    const result = resolveFontVariant('Nothing', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.substituted).toBeUndefined();
  });

  it('does not recurse when the default family is itself unregistered', () => {
    setDefaultFontFamily('Ghost');

    const result = resolveFontVariant('AlsoGhost', 400, 'normal');

    expect(result.entry).toBeNull();
  });
});

describe("'none' policy", () => {
  it('leaves an unregistered family a hard miss even with a default family set', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    setFontFallbackPolicy('none');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.substituted).toBeUndefined();
  });
});
