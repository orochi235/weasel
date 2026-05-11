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
});
