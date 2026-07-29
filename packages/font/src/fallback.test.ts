import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveFontVariant, getFont, _resetFontRegistryForTests } from './registerFont';
import type { FontFallbackPolicy } from './fallback';
import { setDefaultFontFamily, setFontFallbackPolicy, _resetFallbackForTests } from './fallback';
import {
  registerCanvasFont, unregisterCanvasFont, _resetDynamicFontsForTests,
} from './dynamic/dynamicAtlas';
import { registerTestFont } from './testing/registerTestFont';
import { _resetFallbackForTests as resetFallbackFromBarrel } from './index';

const ALL_POLICIES: readonly FontFallbackPolicy[] = ['substitute', 'canvas', 'none'];

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
    // Silenced only: this now warns (see 'unusable default family' below).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setDefaultFontFamily('Ghost');

    const result = resolveFontVariant('AlsoGhost', 400, 'normal');

    expect(result.entry).toBeNull();
    warn.mockRestore();
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

describe('substitute policy — canvas-registered default family', () => {
  it('substitutes a default family that only the dynamic tier can serve', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerCanvasFont('SystemUI');
    setDefaultFontFamily('SystemUI');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    // A canvas family never enters the baked registry, so gating substitution
    // on registry membership made this configuration a silent hard miss.
    expect(result.source).toBe('canvas');
    expect(result.dynamicFace).toBeDefined();
    expect(result.substituted).toEqual({ requested: 'Comic Sans', resolved: 'SystemUI' });
    expect(result.resolved).toEqual({ family: 'SystemUI', weight: 400, style: 'normal' });
    warn.mockRestore();
  });

  it('accepts a registered default family that resolves through the dynamic tier', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Baked at 700/italic only: a 400/normal request walks the whole
    // within-family chain without an anchor and lands on the canvas tier,
    // which returns `entry: null` plus a dynamicFace.
    await registerTestFont('SystemUI', 700, 'italic');
    registerCanvasFont('SystemUI');
    setDefaultFontFamily('SystemUI');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.dynamicFace).toBeDefined();
    expect(result.substituted).toEqual({ requested: 'Comic Sans', resolved: 'SystemUI' });
    expect(result.resolved).toEqual({ family: 'SystemUI', weight: 400, style: 'normal' });
    warn.mockRestore();
  });
});

describe('canvas enrollment provenance', () => {
  it('serves an explicitly registered canvas family under every policy', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    registerCanvasFont('Helvetica Neue');

    for (const policy of ALL_POLICIES) {
      setFontFallbackPolicy(policy);
      const result = resolveFontVariant('Helvetica Neue', 400, 'normal');
      // The consumer asked for this family by name; no policy outranks that.
      expect(result.source, `policy ${policy}`).toBe('canvas');
      expect(result.dynamicFace, `policy ${policy}`).toBeDefined();
      expect(result.substituted, `policy ${policy}`).toBeUndefined();
    }
  });

  it('forgets an auto-enrolled family once the policy leaves canvas', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');

    setFontFallbackPolicy('canvas');
    expect(resolveFontVariant('Comic Sans', 400, 'normal').source).toBe('canvas');

    // 'none' is documented as "the previous behavior" — a prior canvas
    // exposure must not keep the family alive through the dynamic tier.
    setFontFallbackPolicy('none');
    const hard = resolveFontVariant('Comic Sans', 400, 'normal');
    expect(hard.entry).toBeNull();
    expect(hard.dynamicFace).toBeUndefined();
    expect(hard.source).toBe('atlas');

    setFontFallbackPolicy('substitute');
    const substituted = resolveFontVariant('Comic Sans', 400, 'normal');
    expect(substituted.entry).toBe(getFont('Inter', 400, 'normal'));
    expect(substituted.substituted).toEqual({ requested: 'Comic Sans', resolved: 'Inter' });
    warn.mockRestore();
  });

  it('will not substitute to an auto-enrolled family once the policy leaves canvas', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Ghost gets auto-enrolled by the 'canvas' policy…
    setFontFallbackPolicy('canvas');
    expect(resolveFontVariant('Ghost', 400, 'normal').source).toBe('canvas');

    // …and is then named as the substitute default under a policy that no
    // longer serves it. Substituting *to* it here renders nothing at all, so
    // the guard must reject it rather than reporting a swap that paints
    // no glyphs.
    setFontFallbackPolicy('substitute');
    setDefaultFontFamily('Ghost');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.dynamicFace).toBeUndefined();
    expect(result.substituted).toBeUndefined();
    // And the warning names the real gap: Ghost has no baked atlas either.
    expect(warn.mock.calls[0][0]).toContain('is not registered either');
    warn.mockRestore();
  });

  it('promotes an auto-enrolled family to explicit when a consumer registers it', () => {
    setFontFallbackPolicy('canvas');
    resolveFontVariant('Helvetica Neue', 400, 'normal');

    registerCanvasFont('Helvetica Neue');
    setFontFallbackPolicy('none');

    expect(resolveFontVariant('Helvetica Neue', 400, 'normal').source).toBe('canvas');
  });

  it('leaves no stale provenance behind after unregistering', () => {
    setFontFallbackPolicy('canvas');
    resolveFontVariant('Helvetica Neue', 400, 'normal');
    unregisterCanvasFont('Helvetica Neue');

    registerCanvasFont('Helvetica Neue');
    setFontFallbackPolicy('none');

    expect(resolveFontVariant('Helvetica Neue', 400, 'normal').source).toBe('canvas');
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

  it('warns once per variant, not once per resolution', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Comic Sans', 400, 'normal');
    resolveFontVariant('Comic Sans', 400, 'normal');
    // Resolution runs per frame — an unguarded warn floods the console.
    expect(warn).toHaveBeenCalledTimes(1);

    // …but a different variant is a distinct thing the app asked for and
    // did not get, so the dedup must be keyed per variant, not per family.
    resolveFontVariant('Comic Sans', 700, 'normal');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('unusable default family', () => {
  it('warns when the default family cannot serve the requested variant', async () => {
    // Inter is baked only at 700/italic, so substituting it for a 400/normal
    // request resolves to nothing — the exact invisible-text trap the
    // fallback policy exists to eliminate, reached by the likeliest
    // misconfiguration of setDefaultFontFamily.
    await registerTestFont('Inter', 700, 'italic');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.dynamicFace).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    // Naming only the requested family sends the reader to the wrong fix.
    expect(message).toContain('"Inter"');
    expect(message).toContain('setDefaultFontFamily');
    expect(message).toContain('"Comic Sans"');
    warn.mockRestore();
  });

  it('warns when the default family is not registered at all', () => {
    setDefaultFontFamily('Ghost');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('AlsoGhost', 400, 'normal');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"Ghost"');
    warn.mockRestore();
  });

  it('stays silent when no family is registered and no default is set', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Nothing', 400, 'normal');

    // Nothing to substitute and nothing configured: not a misconfiguration.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns when the explicitly set default family was never registered and is what was asked for', () => {
    // The last silent path: someone named a default that does not exist, and
    // then asked for it. Nothing renders, and the previous guard — which
    // required the family to be registered, because its message asserts as
    // much — skipped it entirely.
    setDefaultFontFamily('Ghost');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveFontVariant('Ghost', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.dynamicFace).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toContain('"Ghost"');
    expect(msg).toContain('never registered');
    expect(msg).toContain('setDefaultFontFamily');
    warn.mockRestore();
  });

  it('warns once per variant for an unregistered default', () => {
    setDefaultFontFamily('Ghost');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Ghost', 400, 'normal');
    resolveFontVariant('Ghost', 400, 'normal');
    expect(warn).toHaveBeenCalledTimes(1);

    resolveFontVariant('Ghost', 700, 'normal');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('stays silent when nothing is registered and the request is not the default', () => {
    // No default was ever set, so there is no misconfiguration to report —
    // just an app that has not loaded its fonts yet.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Ghost', 400, 'normal');

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns once per variant', async () => {
    await registerTestFont('Inter', 700, 'italic');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Comic Sans', 400, 'normal');
    resolveFontVariant('Comic Sans', 400, 'normal');
    expect(warn).toHaveBeenCalledTimes(1);

    resolveFontVariant('Comic Sans', 700, 'normal');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('warns when the requested family is itself the unusable default', async () => {
    await registerTestFont('Inter', 700, 'italic');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveFontVariant('Inter', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toContain('Inter');
    expect(msg).toContain('400/normal');
    warn.mockRestore();
  });
});

describe('reset seams', () => {
  it('clears the warn-once cache when only the fallback state is reset', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Comic Sans', 400, 'normal');
    expect(warn).toHaveBeenCalledTimes(1);

    // The registry keeps its fonts; only the fallback state goes back to
    // defaults. A test resetting just this used to swallow its next warning.
    _resetFallbackForTests();
    setDefaultFontFamily('Inter');
    resolveFontVariant('Comic Sans', 400, 'normal');

    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('is reachable from the package barrel like every other reset seam', () => {
    // Policy is global module state that changes rendering: a downstream
    // package's test that sets one has to be able to unset it.
    expect(resetFallbackFromBarrel).toBe(_resetFallbackForTests);
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
