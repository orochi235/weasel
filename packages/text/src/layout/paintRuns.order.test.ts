/**
 * The renderer paints a text command's groups in array order, so what each
 * group holds and where it comes in that order is what the page looks like.
 * This pins both for a paragraph that mixes paints and all three glyph tiers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerFont, FIXTURE_FONT, registerFontOutlines, glyphOutline, resetBakeBudget,
} from '@weasel-js/font';
import {
  _resetFontRegistryForTests, _resetFallbackForTests, _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests, _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import type { Paint } from '@weasel-js/paint';
import { layoutRuns } from './layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';

const OUTLINE_D = 'M0 0L0.5 -0.7L1 0Z';
const EM_DASH = '—';

const solid = (color: string): Paint => ({ kind: 'solid', color });
const GRADIENT: Paint = {
  kind: 'linear-gradient', x0: 0, y0: 0, x1: 1, y1: 0,
  stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
} as Paint;

const run = (text: string, over: Partial<ResolvedRun> = {}): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: solid('#f00') }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
  ...over,
});

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetDynamicFontsForTests();
  _resetFontOutlinesForTests();
  resetBakeBudget();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  __setGlyphRasterizerForTests({
    faceMetrics: () => ({ ascent: 40, descent: 8 }),
    rasterize: () => ({
      width: 20, height: 24, alpha: new Uint8ClampedArray(20 * 24).fill(255),
      left: -8, top: 26, advance: 22,
    }),
  });
  registerFontOutlines('inter', { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
    parser: () => ({
      unitsPerEm: 1000, ascender: 0.8, kernOf: () => 0,
      advanceOf: (cp: number) => (cp === 32 ? 0.25 : 0.6),
      glyphD: (cp: number) => (cp === 32 || cp === 0x2014 ? null : OUTLINE_D),
    }),
  });
  glyphOutline('inter', 400, 'normal', 65);
  await new Promise<void>((r) => setTimeout(r, 0));
});

const round = (n: number): number => Math.round(n * 1000) / 1000;

describe('paint groups of a mixed-paint, mixed-tier paragraph', () => {
  it('come in first-appearance visual order, each with its own glyphs', () => {
    const runs: ResolvedRun[] = [
      run('AB '),
      run(`A${EM_DASH}`, { fill: { paint: solid('#00f') } }),
      run('BA', { underline: true }),
      run('AB', { fontSize: 64, fill: { paint: GRADIENT } }),
      run('A', { stroke: { paint: solid('#0f0'), width: 2 } }),
      run('\n'),
      run('B', { fill: { paint: solid('#0f0') } }),
      run('A'),
    ];
    const out = layoutRuns(runs, {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left', outlineMinSize: 48,
    });

    const groups = out.groups.map((g) => ({
      source: g.source,
      face: `${g.family}|${g.weight}|${g.style}|${g.page}`,
      fill: g.fill?.paint?.kind === 'solid' ? g.fill.paint.color : g.fill?.paint?.kind ?? null,
      stroke: g.stroke?.width ?? null,
      quads: g.quads.map((q) => [q.x0, q.y0, q.x1, q.y1, q.u0, q.v0, q.u1, q.v1, q.baselineY].map(round).join(' ')),
      glyphs: g.glyphs.map((q) => `${q.key} ${q.d} ${round(q.x)} ${round(q.baselineY)} ${q.scale}`),
    }));
    expect(groups).toMatchInlineSnapshot(`
      [
        {
          "face": "inter|400|normal|0",
          "fill": "#f00",
          "glyphs": [],
          "quads": [
            "1 33 23 61 0 0 0.043 0.055 58",
            "24 33 44 61 0.047 0 0.086 0.055 58",
            "91.667 33 111.667 61 0.047 0 0.086 0.055 58",
            "112.667 33 134.667 61 0 0 0.043 0.055 58",
            "23 80.8 45 108.8 0 0 0.043 0.055 105.8",
          ],
          "source": "atlas",
          "stroke": null,
        },
        {
          "face": "inter|400|normal|0",
          "fill": "#00f",
          "glyphs": [],
          "quads": [
            "53 33 75 61 0 0 0.043 0.055 58",
          ],
          "source": "atlas",
          "stroke": null,
        },
        {
          "face": "inter|400|normal|0",
          "fill": "#00f",
          "glyphs": [],
          "quads": [
            "69.667 40.667 83 56.667 0 0 0.02 0.023 58",
          ],
          "source": "canvas",
          "stroke": null,
        },
        {
          "face": "inter|400|normal|0",
          "fill": "linear-gradient",
          "glyphs": [
            "inter|400|normal|65 M0 0L0.5 -0.7L1 0Z 134.667 58 64",
            "inter|400|normal|66 M0 0L0.5 -0.7L1 0Z 178.667 58 64",
          ],
          "quads": [],
          "source": "outline",
          "stroke": null,
        },
        {
          "face": "inter|400|normal|0",
          "fill": "#f00",
          "glyphs": [
            "inter|400|normal|65 M0 0L0.5 -0.7L1 0Z 222.667 58 32",
          ],
          "quads": [],
          "source": "outline",
          "stroke": 2,
        },
        {
          "face": "inter|400|normal|0",
          "fill": "#0f0",
          "glyphs": [],
          "quads": [
            "2 80.8 22 108.8 0.047 0 0.086 0.055 105.8",
          ],
          "source": "atlas",
          "stroke": null,
        },
      ]
    `);

    const decorations = out.decorations.map((d) =>
      `${d.kind} ${[d.x0, d.y0, d.x1, d.y1].map(round).join(' ')} ${d.fill.paint?.kind === 'solid' ? d.fill.paint.color : ''}`);
    expect(decorations).toMatchInlineSnapshot(`
      [
        "underline 89.667 61.2 134.667 62.8 #f00",
      ]
    `);
  });
});
