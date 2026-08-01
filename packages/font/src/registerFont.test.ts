import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerFont, getFont, resolveFontVariant, resolveGlyphFallback, listFonts,
  _resetFontRegistryForTests,
} from './registerFont';
import { setFontFallbackPolicy, _resetFallbackForTests } from './fallback';
import { FIXTURE_FONT } from './FontAtlas';
import {
  registerCanvasFont, _resetDynamicFontsForTests, __setGlyphRasterizerForTests,
} from './dynamic/dynamicAtlas';
import { BAKE_SIZE } from './dynamic/glyphRasterizer';
import { registerTestFont } from './testing/registerTestFont';
import { subscribeGlyphReady } from './glyphReady';

function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(FIXTURE_FONT),
      });
    }
    if (url.endsWith('.png')) {
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      });
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  }) as typeof fetch;

  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('registerFont', () => {
  it('stores a parsed BmFont after successful fetch', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const entry = getFont('inter', 400, 'normal');
    expect(entry).not.toBeNull();
    expect(entry!.font.info.face).toBe('Inter');
    expect(entry!.font.charMap.size).toBe(2);
  });

  it('calling twice for the same family is a no-op (returns same entry)', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const first = getFont('inter', 400, 'normal');
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const second = getFont('inter', 400, 'normal');
    expect(first).toBe(second);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('getFont returns null for unknown family', () => {
    expect(getFont('unknown', 400, 'normal')).toBeNull();
  });

  it('rejects with an informative error when fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));
    await expect(
      registerFont('bad', {}, '/bad.json', '/bad.png'),
    ).rejects.toThrow('weasel registerFont');
  });
});

describe('registerFont variants', () => {
  it('stores regular and bold separately under the same family', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    expect(getFont('inter', 400, 'normal')).not.toBeNull();
    expect(getFont('inter', 700, 'normal')).not.toBeNull();
    expect(getFont('inter', 400, 'normal')).not.toBe(getFont('inter', 700, 'normal'));
  });

  it('stores italic separately from normal', async () => {
    await registerFont('inter', { style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    expect(getFont('inter', 400, 'normal')).not.toBe(getFont('inter', 400, 'italic'));
  });

  it('defaults weight to 400 and style to normal when variant fields are omitted', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    expect(getFont('inter', 400, 'normal')).not.toBeNull();
  });

  it('re-registering the same (family, weight, style) is a no-op', async () => {
    await registerFont('inter', { weight: 700 }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const first = getFont('inter', 700, 'normal');
    await registerFont('inter', { weight: 700 }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const second = getFont('inter', 700, 'normal');
    expect(first).toBe(second);
  });

  it('does not drop a variant when the second-issued call resolves before the first (concurrent race)', async () => {
    // Regression for 7aa2a347: registerFont used to snapshot the family's
    // Map before its awaits, so if two variants of the same new family are
    // registered concurrently (e.g. weight 400 and 700 via Promise.all) and
    // the second-issued call's fetches resolve first, the first-issued
    // call's stale snapshot (still undefined) would recreate the family Map
    // on completion and silently drop whichever variant landed first.
    //
    // Gate the first-issued call's metrics fetch on a manually-released
    // promise so the second-issued call's registerFont() provably resolves
    // first, then release the gate — deterministic ordering, no timers.
    let firstJsonCallSeen = false;
    let releaseFirstMetrics: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseFirstMetrics = resolve;
    });

    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('.json')) {
        if (!firstJsonCallSeen) {
          firstJsonCallSeen = true;
          // First-issued call (weight 400): metrics fetch waits for release.
          return gate.then(() => ({
            ok: true,
            json: () => Promise.resolve(FIXTURE_FONT),
          }));
        }
        // Second-issued call (weight 700): resolves immediately.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(FIXTURE_FONT),
        });
      }
      if (url.endsWith('.png')) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
        });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    }) as typeof fetch;

    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);

    const firstCall = registerFont('newfam', { weight: 400 }, '/fonts/newfam/newfam.json', '/fonts/newfam/newfam.png');
    const secondCall = registerFont('newfam', { weight: 700 }, '/fonts/newfam/newfam.json', '/fonts/newfam/newfam.png');

    // The second-issued call is unblocked and resolves first.
    await secondCall;
    // Now release the first-issued call's gated metrics fetch.
    releaseFirstMetrics();
    await firstCall;

    expect(getFont('newfam', 400, 'normal')).not.toBeNull();
    expect(getFont('newfam', 700, 'normal')).not.toBeNull();
  });
});

describe('resolveFontVariant', () => {
  it('returns exact match with no synthetic flags', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 400, 'normal');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: false });
  });

  it('falls back from missing italic to normal with synthetic.italic=true', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 400, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: true });
  });

  it('falls back from missing bold to regular with synthetic.bold=true', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'normal');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: true, italic: false });
  });

  it('falls back from missing bold-italic to bold with synthetic.italic=true (real bold)', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: true });
  });

  it('falls back from missing bold-italic to italic with synthetic.bold=true (real italic)', async () => {
    await registerFont('inter', { weight: 400, style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: true, italic: false });
  });

  it('prefers the nearer weight in the same bucket', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { weight: 900, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 750, 'normal');
    expect(r.entry).toBe(getFont('inter', 700, 'normal'));
  });

  it('breaks weight-distance ties by picking the heavier weight', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { weight: 900, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 800, 'normal');
    expect(r.entry).toBe(getFont('inter', 900, 'normal'));
  });

  it('returns null entry when the family has no variants', () => {
    const r = resolveFontVariant('missing', 400, 'normal');
    expect(r.entry).toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: false });
  });

  it('reports resolved weight/style on exact match', async () => {
    await registerFont('inter', { weight: 700, style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'italic');
    expect(r.resolved).toEqual({ family: 'inter', weight: 700, style: 'italic' });
  });

  it('reports resolved weight/style after step 2 nearest-weight fallback', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 750, 'normal');
    // Resolved to the registered 700 — cache key must use 700, not the requested 750.
    expect(r.resolved).toEqual({ family: 'inter', weight: 700, style: 'normal' });
  });

  it('reports resolved weight/style after step 4 italic-drop fallback', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'italic');
    expect(r.resolved).toEqual({ family: 'inter', weight: 700, style: 'normal' });
  });

  it('reports requested weight/style when nothing resolves (null entry)', () => {
    const r = resolveFontVariant('missing', 750, 'italic');
    expect(r.entry).toBeNull();
    expect(r.resolved).toEqual({ family: 'missing', weight: 750, style: 'italic' });
  });
});

describe('resolveFontVariant — canvas-dynamic tier', () => {
  beforeEach(() => {
    _resetDynamicFontsForTests();
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
  });

  it('serves a canvas-registered family with no baked atlas as source "canvas"', () => {
    registerCanvasFont('Futura');
    const r = resolveFontVariant('Futura', 400, 'normal');
    expect(r.entry).toBeNull();
    expect(r.source).toBe('canvas');
    expect(r.dynamicFace).toBeDefined();
    expect(r.dynamicFace!.font.info.size).toBe(BAKE_SIZE);
    expect(r.resolved).toEqual({ family: 'Futura', weight: 400, style: 'normal' });
    expect(r.synthetic).toEqual({ bold: false, italic: false });
  });

  it('baked always wins: a registered atlas shadows the canvas registration', async () => {
    await registerFont('Futura', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    registerCanvasFont('Futura');
    const r = resolveFontVariant('Futura', 400, 'normal');
    expect(r.entry).not.toBeNull();
    expect(r.source).toBe('atlas');
    expect(r.dynamicFace).toBeUndefined();
  });

  it('dynamic face carries the requested weight/style (real bold, no synthetic)', () => {
    registerCanvasFont('Futura');
    const r = resolveFontVariant('Futura', 700, 'italic');
    expect(r.source).toBe('canvas');
    expect(r.dynamicFace!.weight).toBe(700);
    expect(r.dynamicFace!.style).toBe('italic');
    expect(r.synthetic).toEqual({ bold: false, italic: false });
  });

  it('an unregistered family is still a plain miss', () => {
    const r = resolveFontVariant('Nope', 400, 'normal');
    expect(r.entry).toBeNull();
    expect(r.source).toBe('atlas');
    expect(r.dynamicFace).toBeUndefined();
  });

  it('serves the canvas tier when the fallback chain finds no anchor among the baked variants', async () => {
    // Only a 700/italic atlas is baked, but 400/normal is requested. The chain
    // has no same-style (normal) or same-weight (400) anchor to select, so it
    // falls through to the canvas tier — which rasterizes a clean 400/normal
    // upright rather than mangling the 700/italic baked atlas synthetically.
    await registerFont('Futura', { weight: 700, style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    registerCanvasFont('Futura');
    const r = resolveFontVariant('Futura', 400, 'normal');
    expect(r.source).toBe('canvas');
    expect(r.dynamicFace).toBeDefined();
  });

  it('partial-baked family with only one variant still resolves via the synthetic fallback chain, not the canvas tier', async () => {
    await registerFont('Futura', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    registerCanvasFont('Futura');
    const r = resolveFontVariant('Futura', 700, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.source).toBe('atlas');
    expect(r.dynamicFace).toBeUndefined();
    expect(r.synthetic).toEqual({ bold: true, italic: true });
  });
});

describe('listFonts', () => {
  it('reports each registered family with its variants', async () => {
    await registerTestFont('Inter', 400, 'normal');
    await registerTestFont('Inter', 700, 'normal');
    await registerTestFont('Roboto', 400, 'italic');

    expect(listFonts()).toEqual([
      { family: 'Inter', variants: [{ weight: 400, style: 'normal' }, { weight: 700, style: 'normal' }] },
      { family: 'Roboto', variants: [{ weight: 400, style: 'italic' }] },
    ]);
  });

  it('is empty before anything registers', () => {
    expect(listFonts()).toEqual([]);
  });

  it('sorts variants by weight then style', async () => {
    await registerTestFont('Inter', 700, 'italic');
    await registerTestFont('Inter', 400, 'normal');
    await registerTestFont('Inter', 400, 'italic');

    expect(listFonts()[0].variants).toEqual([
      { weight: 400, style: 'italic' },
      { weight: 400, style: 'normal' },
      { weight: 700, style: 'italic' },
    ]);
  });
});

describe('resolveGlyphFallback', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    _resetDynamicFontsForTests();
    _resetFallbackForTests();
  });

  function stubRasterizer() {
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 12, height: 16, alpha: new Uint8ClampedArray(12 * 16).fill(255),
        left: -4, top: 18, advance: 14,
      }),
    });
  }

  it('serves the codepoint from the dynamic tier', () => {
    stubRasterizer();
    const out = resolveGlyphFallback('Inter', 400, 'normal');
    expect(out).not.toBeNull();
    expect(out!.source).toBe('canvas');
    expect(out!.dynamicFace).toBeDefined();
    // U+2014 is not in any atlas here; the face bakes it on request.
    expect(out!.dynamicFace!.requestGlyph(0x2014).xadvance).toBe(14);
  });

  it('reports the real weight and style, so nothing is synthesized', () => {
    stubRasterizer();
    const out = resolveGlyphFallback('Inter', 700, 'italic');
    expect(out!.resolved).toEqual({ family: 'Inter', weight: 700, style: 'italic' });
    expect(out!.synthetic).toEqual({ bold: false, italic: false });
  });

  it('declines under the "none" policy, which documents a hard miss', () => {
    stubRasterizer();
    setFontFallbackPolicy('none');
    expect(resolveGlyphFallback('Inter', 400, 'normal')).toBeNull();
  });

  it('declines rather than throwing when the rasterizer cannot serve', () => {
    // The environments this guards are SSR and any headless context without a
    // canvas, where constructing the rasterizer throws outright. Standing in
    // for that here with one that fails to measure — same reachable failure,
    // and it does not depend on what jsdom happens to provide.
    __setGlyphRasterizerForTests({
      faceMetrics: () => { throw new Error('no canvas'); },
      rasterize: () => { throw new Error('no canvas'); },
    });
    // Escalation is a nicety; it must not take the layout pass down with it.
    expect(() => resolveGlyphFallback('Inter', 400, 'normal')).not.toThrow();
    expect(resolveGlyphFallback('Inter', 400, 'normal')).toBeNull();
  });

  it('caches the face across calls', () => {
    stubRasterizer();
    const a = resolveGlyphFallback('Inter', 400, 'normal');
    const b = resolveGlyphFallback('Inter', 400, 'normal');
    expect(a!.dynamicFace).toBe(b!.dynamicFace);
  });
});

describe('registerFont and the glyph-ready signal', () => {
  it('notifies subscribers once a family is registered', async () => {
    // `subscribeGlyphReady` means "a glyph the renderer asked for can now
    // paint", which is exactly true of a family finishing registration: text
    // that was falling back to another face — or painting nothing — can now
    // paint from it. Both lazy tiers already fire it; the static path did not,
    // so a font registered mid-session left the canvas showing the pre-load
    // rendering until something unrelated forced a redraw. It also gates the
    // renderer's text-layout cache, which must not keep serving a layout
    // measured against the face this replaces.
    const seen = vi.fn();
    const unsubscribe = subscribeGlyphReady(seen);
    try {
      await registerFont('notify-me', {}, '/fonts/x.json', '/fonts/x.png');
      expect(seen).toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('does not notify when the variant was already registered', async () => {
    // The early return for an already-present variant does no work, so it has
    // nothing to announce — and a redraw per redundant call would be a cheap
    // way to pin the canvas at full tilt.
    await registerFont('already', {}, '/fonts/x.json', '/fonts/x.png');
    const seen = vi.fn();
    const unsubscribe = subscribeGlyphReady(seen);
    try {
      await registerFont('already', {}, '/fonts/x.json', '/fonts/x.png');
      expect(seen).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
