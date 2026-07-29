import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveFontVariant, getFont, _resetFontRegistryForTests } from './registerFont';
import { setDefaultFontFamily, setFontFallbackPolicy, _resetFallbackForTests } from './fallback';
import { _resetDynamicFontsForTests } from './dynamic/dynamicAtlas';
import { registerTestFont } from './testing/registerTestFont';

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  // Canvas enrollment is process-global too: without this a family the
  // 'canvas' policy auto-enrolled stays enrolled for every later test.
  _resetDynamicFontsForTests();
});

describe('substitute policy', () => {
  it('resolves an unregistered family to the default family', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBe(getFont('Inter', 400, 'normal'));
    expect(result.substituted).toEqual({ requested: 'Comic Sans', resolved: 'Inter' });
    // The atlas identity a renderer keys its texture lookup on. Reporting the
    // requested family here is what made substitution a visual no-op.
    expect(result.resolved).toEqual({ family: 'Inter', weight: 400, style: 'normal' });
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

describe('canvas policy', () => {
  it('auto-registers an unknown family with the dynamic rasterizer', () => {
    setFontFallbackPolicy('canvas');

    const result = resolveFontVariant('Helvetica Neue', 400, 'normal');

    expect(result.source).toBe('canvas');
    expect(result.dynamicFace).toBeDefined();
    expect(result.substituted).toBeUndefined();
  });

  it('prefers a baked atlas over canvas enrollment', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setFontFallbackPolicy('canvas');

    const result = resolveFontVariant('Inter', 400, 'normal');

    expect(result.source).toBe('atlas');
    expect(result.entry).not.toBeNull();
  });
});

describe('warning accuracy', () => {
  it('distinguishes an unregistered family from one with no matching variant', async () => {
    // Slab is registered, but only as 700/italic. A 400/normal request walks
    // the whole within-family chain (exact → nearest weight in bucket →
    // (400, style) → (weight, 'normal') → nearest normal → (400, 'normal'))
    // without ever reaching an italic-only, bold-bucket variant, so it lands
    // in the same miss path an unregistered family does.
    await registerTestFont('Inter', 400, 'normal');
    await registerTestFont('Slab', 700, 'italic');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveFontVariant('Slab', 400, 'normal');

    expect(result.substituted).toEqual({ requested: 'Slab', resolved: 'Inter' });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).not.toContain('is not registered');
    expect(message).toContain('no variant matching 400/normal');
    warn.mockRestore();
  });

  it('still says a never-registered family is not registered', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Comic Sans', 400, 'normal');

    expect(warn.mock.calls[0][0]).toContain('is not registered');
    warn.mockRestore();
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
