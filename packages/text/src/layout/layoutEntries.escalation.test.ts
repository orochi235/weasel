import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIXTURE_FONT, resetBakeBudget, setFontFallbackPolicy } from '@weasel-js/font';
import {
  _resetFontRegistryForTests,
  _resetFallbackForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — a codepoint the atlas does not cover', () => {
  // U+2014. The fixture atlas carries 'A' and 'B' and nothing else, so this
  // is the same shape as the real defect: a run resolves to a perfectly good
  // atlas that simply never baked the character.
  const EM_DASH = '—';
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

  const run = (text: string): ResolvedRun => ({
    text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  });

  function stubRasterizer() {
    __setGlyphRasterizerForTests({
      faceMetrics: () => ({ ascent: 40, descent: 8 }),
      rasterize: () => ({
        width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
        left: -8, top: 26, advance: 22,
      }),
    });
  }

  beforeEach(() => {
    _resetDynamicFontsForTests();
    _resetFallbackForTests();
    resetBakeBudget();
  });

  it('escalates it to the dynamic tier instead of dropping it', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    const out = layoutAndPaint([run(`A${EM_DASH}B`)], OPTS);

    // Two groups: the atlas serves A and B, the dynamic tier serves the dash.
    // They cannot merge — different texture, different shader.
    const atlas = out.groups.filter((g) => g.source === 'atlas');
    const canvas = out.groups.filter((g) => g.source === 'canvas');
    expect(atlas).toHaveLength(1);
    expect(canvas).toHaveLength(1);
    expect(atlas[0].quads).toHaveLength(2);
    expect(canvas[0].quads).toHaveLength(1);
  });

  it('does not substitute a literal "?"', async () => {
    // An atlas that DOES carry '?' is the case the old fallback silently hit:
    // it drew a character the author never wrote, indistinguishable from one
    // they did.
    const withQuestion = {
      ...FIXTURE_FONT,
      chars: [
        ...FIXTURE_FONT.chars,
        { id: 63, x: 48, y: 0, width: 18, height: 28, xoffset: 1, yoffset: 4, xadvance: 20, page: 0 },
      ],
    };
    global.fetch = vi.fn().mockImplementation((url: string) =>
      url.endsWith('.json')
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(withQuestion) })
        : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }),
    ) as typeof fetch;
    await registerFixture('inter', [{}]);
    stubRasterizer();

    const out = layoutAndPaint([run(EM_DASH)], OPTS);
    // The one quad is the dash from the dynamic tier, not '?' from the atlas.
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('canvas');
    expect(out.groups[0].quads).toHaveLength(1);
  });

  it('sets the escalated glyph between its neighbours, at its own scale', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    const out = layoutAndPaint([run(`A${EM_DASH}B`)], OPTS);

    const [a, b] = out.groups.find((g) => g.source === 'atlas')!.quads;
    const dash = out.groups.find((g) => g.source === 'canvas')!.quads[0];
    // Deliberately not a width comparison against 'AB': dropping a glyph also
    // drops the kerning pair across it, so a bare `wider than` assertion
    // passes on a 1-unit kerning shift with no dash drawn at all.
    expect(dash.x0).toBeGreaterThan(a.x0);
    expect(b.x0).toBeGreaterThan(dash.x1);

    // The stub bakes 20×24 at BAKE_SIZE 48; at fontSize 32 that is scale 2/3.
    // Getting this wrong means scaling the escalated glyph by the *atlas's*
    // info.size (32) — it would come out half again too big.
    expect(dash.x1 - dash.x0).toBeCloseTo(20 * (32 / 48), 6);
  });

  it('skips the character under the "none" policy, which documents a hard miss', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    setFontFallbackPolicy('none');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = layoutAndPaint([run(`A${EM_DASH}B`)], OPTS);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('atlas');
    expect(out.groups[0].quads).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('U+2014');
    warn.mockRestore();
  });

  it('warns once per codepoint however often it appears', async () => {
    await registerFixture('inter', [{}]);
    stubRasterizer();
    setFontFallbackPolicy('none');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    layoutAndPaint([run(`${EM_DASH}${EM_DASH}${EM_DASH}`)], OPTS);
    layoutAndPaint([run(EM_DASH)], OPTS);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
