import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import type { BidiResolver } from './bidiSeam';
import { layoutRuns, type LaidOutLineBox } from './layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';

beforeEach(async () => {
  _resetFontRegistryForTests();
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
  await registerFont('inter', {}, '/f.json', '/f.png');
});

const RUN: ResolvedRun = {
  text: 'ABA', fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
};

/** An engine whose every line comes back in `order`, all left to right. */
const engine = (order: readonly number[]): BidiResolver => ({
  analyze: () => null,
  reorder: () => ({ order, levels: [0, 0, 0] }),
  mirror: () => null,
  baseLevel: () => 0,
});

const line = (order?: readonly number[]): LaidOutLineBox => layoutRuns([RUN], {
  maxWidth: Infinity, lineHeight: 1.2, align: 'left', ...(order ? { bidi: engine(order) } : {}),
}).lines[0];

describe('a reordering that is not a permutation of its line', () => {
  it.each([
    ['repeats a position and omits another', [0, 0, 2]],
    ['repeats a position', [0, 1, 1, 2]],
    ['names a position between two code points', [0, 1.5, 2]],
    ['names positions outside the line', [-1, 0, 1, 2, 3]],
  ])('places every code point once when it %s', (_name, order) => {
    const logical = line();
    const { cells, glyphs } = line(order);
    expect(glyphs.map((g) => g.x)).toEqual(logical.glyphs.map((g) => g.x));
    expect(cells).toEqual(logical.cells);
  });

  it('keeps the first of a repeated position, and puts an omitted one after the one before it', () => {
    const { cells, glyphs } = line([2, 0, 2]);
    expect(glyphs.map((g) => g.cp)).toEqual([65, 65, 66]);
    expect(cells[2].x).toBe(0);
    expect(cells[0].x).toBeLessThan(cells[1].x);
  });
});
