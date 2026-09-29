/**
 * Tier agreement for decoration and script metrics: one font, served once as
 * a baked atlas and once as parsed outlines, must place its rules and its
 * scripts identically. A metric honored on one tier and not the other would
 * move a rule, or reflow a superscript, as text crossed between them.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerFont, registerFontOutlines, glyphOutline, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { layoutRuns } from './layoutRuns';
import { resolveRuns } from '../runs/resolveRuns';
import { resolveTextStyle } from '../textStyle';
import { createMarkdownRenderer } from '../markdownText';
import type { StyledRun } from '../runs';

const ROOT = resolve(import.meta.dirname, '../../../..');
const INTER_JSON = JSON.parse(readFileSync(resolve(ROOT, 'assets/fonts/inter/inter.json'), 'utf8'));
const ttf = readFileSync(resolve(ROOT, 'assets/fonts/inter/inter.ttf'));
// Copied through this realm's Uint8Array: a Node Buffer's ArrayBuffer fails the
// registry's `instanceof ArrayBuffer` under vmThreads.
const INTER_TTF = new Uint8Array(ttf).buffer;

beforeAll(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const json = url.includes('fixture') ? FIXTURE_FONT : INTER_JSON;
    if (url.endsWith('.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 256, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter-atlas', {}, '/inter.json', '/inter.png');
  await registerFont('no-metrics', {}, '/fixture.json', '/fixture.png');
  registerFontOutlines('inter-outline', {}, INTER_TTF);
  glyphOutline('inter-outline', 400, 'normal', 65);
  await vi.waitFor(() => expect(glyphOutline('inter-outline', 400, 'normal', 65)).not.toBeNull());
});

const RUNS: StyledRun[] = [
  { text: 'AB', underline: true },
  { text: 'AB', strikethrough: true },
  { text: 'AB', overline: true },
  { text: 'A', script: 'super' },
  { text: 'B', script: 'sub' },
];

function lay(fontFamily: string) {
  const runs = resolveRuns(RUNS, resolveTextStyle({ fontFamily, fontSize: 40 }));
  const laid = layoutRuns(runs, { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
  return { runs, laid };
}

const rules = (f: string) => lay(f).laid.decorations.map(({ kind, y0, y1 }) => ({ kind, y0, y1 }));
const scripts = (f: string) =>
  lay(f).runs.slice(3).map(({ fontSize, baselineShift }) => ({ fontSize, baselineShift }));

describe('face metrics across tiers', () => {
  it('serves each family from the tier it is standing in for', () => {
    expect(lay('inter-atlas').laid.groups.map((g) => g.source)).not.toContain('outline');
    expect(lay('inter-outline').laid.groups.every((g) => g.source === 'outline')).toBe(true);
  });

  it("places every rule identically on both tiers, at the font's own offsets", () => {
    const atlas = rules('inter-atlas');
    expect(rules('inter-outline')).toEqual(atlas);
    const underline = atlas.find((d) => d.kind === 'underline')!;
    const strike = atlas.find((d) => d.kind === 'strikethrough')!;
    // Inter: post.underlinePosition -348, underlineThickness 140 and
    // OS/2.yStrikeoutPosition 671, of 2048.
    expect(underline.y1 - underline.y0).toBeCloseTo(40 * 140 / 2048, 9);
    expect(underline.y0 - strike.y0).toBeCloseTo(40 * (348 + 671) / 2048, 9);
  });

  it("gives the overline the face's underline weight, since no table places one", () => {
    const over = rules('inter-atlas').find((d) => d.kind === 'overline')!;
    expect(over.y1 - over.y0).toBeCloseTo(40 * 140 / 2048, 9);
  });

  it("places the 2D path's rules and scripts where the GL tier does, off the baseline", () => {
    const rects: { y: number; h: number }[] = [];
    const texts: { text: string; y: number }[] = [];
    const ctx = {
      font: '', fillStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic', direction: 'ltr',
      measureText: (t: string) => ({ width: t.length * 10 }),
      fillText: (text: string, _x: number, y: number) => { texts.push({ text, y }); },
      fillRect: (_x: number, y: number, _w: number, h: number) => { rects.push({ y, h }); },
    } as unknown as CanvasRenderingContext2D;
    const runs: StyledRun[] = [
      { text: 'AB', underline: true, strikethrough: true },
      { text: 'A', script: 'super' },
    ];
    createMarkdownRenderer(ctx, runs, 40, Infinity, { family: 'inter-atlas' }).renderer(ctx, '', 0, 0);
    const gl = layoutRuns(
      resolveRuns([runs[0]], resolveTextStyle({ fontFamily: 'inter-atlas', fontSize: 40 })),
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
    );
    const baseline = gl.lines[0].baselineY;
    expect(rects).toEqual(gl.decorations.map((d) => ({ y: d.y0 - baseline, h: d.y1 - d.y0 })));
    const sup = scripts('inter-atlas')[0];
    expect(texts[1].y).toBeCloseTo(-sup.baselineShift, 9);
  });

  it('sizes and raises scripts identically on both tiers, from OS/2', () => {
    expect(scripts('inter-outline')).toEqual(scripts('inter-atlas'));
    const [sup, sub] = scripts('inter-atlas');
    expect(sup.fontSize).toBeCloseTo(40 * 1229 / 2048, 9);
    expect(sup.baselineShift).toBeCloseTo(40 * 717 / 2048, 9);
    expect(sub.fontSize).toBeCloseTo(40 * 1229 / 2048, 9);
    expect(sub.baselineShift).toBeCloseTo(-40 * 154 / 2048, 9);
  });

  it("sizes small caps identically on both tiers, at the face's x-height over its cap height", () => {
    const sizes = (fontFamily: string) =>
      resolveRuns([{ text: 'Hx', fontVariantCaps: 'small-caps' }], resolveTextStyle({ fontFamily, fontSize: 40 }))[0].sizeMap;
    expect(sizes('inter-outline')).toEqual(sizes('inter-atlas'));
    // Inter: OS/2.sxHeight 1118 and sCapHeight 1490.
    const [cap, small] = sizes('inter-atlas')!;
    expect(cap).toBe(40);
    expect(small).toBeCloseTo(40 * 1118 / 1490, 9);
    expect(sizes('no-metrics')![1]).toBeCloseTo(40 * 0.7, 9);
  });

  it('falls back to the derived constants for an atlas with no metrics block', () => {
    const { runs, laid } = lay('no-metrics');
    const underline = laid.decorations.find((d) => d.kind === 'underline')!;
    expect(underline.y1 - underline.y0).toBeCloseTo(40 * 0.05, 9);
    expect(runs[3].fontSize).toBeCloseTo(40 * 0.583, 9);
    expect(runs[4].baselineShift).toBeCloseTo(-40 * 0.333, 9);
  });
});
