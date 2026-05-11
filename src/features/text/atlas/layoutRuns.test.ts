import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, registerFont } from './registerFont';
import { FIXTURE_FONT } from './FontAtlas';
import { layoutRuns } from './layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';

function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
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

async function registerFixture(family: string, opts: Array<{ weight?: number; style?: 'normal'|'italic' }>) {
  for (const v of opts) {
    await registerFont(family, v, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  }
}

const RUN_PLAIN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' },
});
const RUN_BOLD = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontWeight: 700 });
const RUN_ITALIC = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontStyle: 'italic' });

describe('layoutRuns — single line', () => {
  it('returns one group when all runs share the same variant', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].weight).toBe(400);
    expect(out.groups[0].style).toBe('normal');
    expect(out.groups[0].quads).toHaveLength(2);
  });

  it('emits one group per distinct (family, weight, style, synthetic, fill)', async () => {
    await registerFixture('inter', [{}, { weight: 700 }]);
    const out = layoutRuns(
      [RUN_PLAIN('A'), RUN_BOLD('B'), RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(2);
    const regular = out.groups.find((g) => g.weight === 400)!;
    const bold = out.groups.find((g) => g.weight === 700)!;
    expect(regular.quads).toHaveLength(2);
    expect(bold.quads).toHaveLength(1);
  });

  it('marks groups with synthetic flags when the resolver fell back', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_ITALIC('A')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('per-run fill forces a separate group even for the same atlas variant', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...RUN_PLAIN('A'), fill: { fill: 'solid', color: '#f00' } };
    const out = layoutRuns(
      [RUN_PLAIN('A'), RED, RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(2);
  });

  it('positions glyphs across runs on the same baseline with kerning carrying through', async () => {
    await registerFixture('inter', [{}]);
    const single = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const split = layoutRuns([RUN_PLAIN('A'), RUN_PLAIN('B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const singleX = single.groups[0].quads.map((q) => q.x0);
    const splitX = split.groups.flatMap((g) => g.quads.map((q) => q.x0)).sort((a, b) => a - b);
    expect(splitX).toEqual(singleX);
  });

  it('returns no groups when the family is unregistered', () => {
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), fontFamily: 'missing' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(0);
    expect(out.bounds.width).toBe(0);
  });

  it('records the typographic baseline (not the line-box top) on each quad', async () => {
    await registerFixture('inter', [{}]);
    // FIXTURE_FONT: info.size=32, common.base=29.
    // RUN_PLAIN: fontSize=32 → scale=1.
    // origin.y=100 → expected baselineY = 100 + 29 * 1 = 129.
    const out = layoutRuns(
      [RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 100 },
    );
    expect(out.groups[0].quads[0].baselineY).toBe(129);
  });
});

describe('layoutRuns — word wrap', () => {
  it('wraps a single run at space boundaries when content exceeds maxWidth', async () => {
    await registerFixture('inter', [{}]);
    // Fixture font has only 'A' (xadvance ~23 at size 32). Use width that
    // forces at least one wrap for the text below.
    const text = 'ABAB ABAB ABAB ABAB';
    const out = layoutRuns(
      [RUN_PLAIN(text)],
      { maxWidth: 150, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const quads = out.groups[0].quads;
    expect(quads.length).toBeGreaterThan(4);
    const firstY = quads[0].y0;
    const lastY = quads[quads.length - 1].y0;
    expect(lastY).toBeGreaterThan(firstY);
  });

  it('mixed-size runs share a baseline on the same line', async () => {
    await registerFixture('inter', [{}]);
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 16 };
    const big: ResolvedRun = { ...RUN_PLAIN('B'), fontSize: 40 };
    const out = layoutRuns(
      [small, big],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const allQuads = out.groups.flatMap((g) => g.quads);
    expect(allQuads).toHaveLength(2);
  });

  it('alignment shifts each line by (maxWidth - lineWidth) * factor', async () => {
    await registerFixture('inter', [{}]);
    const leftOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const centerOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'center' }, { x: 0, y: 0 });
    const rightOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'right' }, { x: 0, y: 0 });
    const leftX = leftOut.groups[0].quads[0].x0;
    const centerX = centerOut.groups[0].quads[0].x0;
    const rightX = rightOut.groups[0].quads[0].x0;
    expect(centerX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThan(centerX);
  });

  it('respects newlines inside a run as forced line breaks', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [RUN_PLAIN('A\nB')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const quads = out.groups[0].quads;
    expect(quads).toHaveLength(2);
    expect(quads[1].y0).toBeGreaterThan(quads[0].y0);
  });
});
