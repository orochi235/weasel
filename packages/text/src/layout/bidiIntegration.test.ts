/**
 * The seam against the real algorithm.
 *
 * `layoutRuns` declares `BidiResolver` and `@weasel-js/bidi` satisfies it, with
 * neither package importing the other. Types lining up is not evidence that the
 * semantics do, so this drives actual right-to-left strings through the actual
 * engine — which is why `@weasel-js/bidi` is a devDependency here and appears
 * in no tarball.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { bidi } from '@weasel-js/bidi';
import { layoutRuns } from './layoutRuns';
import type { LayoutRunsOpts } from './layoutRuns';
import type { BidiResolver } from './bidiSeam';
import type { ResolvedRun } from '../runs/resolveRuns';

/** The compile-time half of the claim: the engine *is* a resolver. */
const engine: BidiResolver = bidi;

function stubFetch() {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  stubFetch();
  await registerFont('inter', {}, '/f.json', '/f.png');
});

const RUN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});

const OPTS: LayoutRunsOpts = {
  maxWidth: 400, lineHeight: 1.2, align: 'left', bidi: engine,
};
/** Cell indices sorted by where they were painted, left to right. */
const visual = (text: string, opts = OPTS) => {
  const out = layoutRuns([RUN(text)], opts);
  const cells = out.lines[0].cells;
  return cells.map((_, i) => i).sort((a, b) => cells[a].x - cells[b].x);
};

describe('layoutRuns with the real bidi engine', () => {
  it('leaves Latin text in logical order', () => {
    expect(visual('AB')).toEqual([0, 1]);
  });

  it('reverses a Hebrew string', () => {
    expect(visual('אבג')).toEqual([2, 1, 0]);
  });

  it('keeps digits reading left to right inside Hebrew', () => {
    // The case that makes this more than reversal: naive reversal renders 25
    // as 52, which is a different number.
    const order = visual('אב 25');
    const digits = order.filter((i) => i >= 3);
    expect(digits).toEqual([3, 4]);
  });

  it('keeps cells in logical order while x is not', () => {
    const out = layoutRuns([RUN('אב')], OPTS);
    const cells = out.lines[0].cells;
    expect(cells.map((c) => c.cp)).toEqual([0x05d0, 0x05d1]);
    expect(cells[0].x).toBeGreaterThan(cells[1].x);
  });

  it('reports an odd level on right-to-left cells', () => {
    const out = layoutRuns([RUN('אב')], OPTS);
    expect(out.lines[0].cells.every((c) => c.level % 2 === 1)).toBe(true);
  });

  it('lays the same string out logically with no engine', () => {
    const withEngine = visual('אבג');
    const without = visual('אבג', { ...OPTS, bidi: undefined });
    expect(withEngine).toEqual([2, 1, 0]);
    expect(without).toEqual([0, 1, 2]);
  });

  it('gives every code point a cell whichever way the line reads', () => {
    const out = layoutRuns([RUN('אב 25')], OPTS);
    expect(out.lines[0].cells).toHaveLength(5);
  });
});

describe('L4 — mirroring', () => {
  it('paints a bracket as its mirror inside a right-to-left run', () => {
    // The fixture atlas has no bracket glyphs, so the observable is the cell's
    // code point rather than a quad: '(' opening a Hebrew phrase reads as ')'.
    const out = layoutRuns([RUN('א(ב')], OPTS);
    const bracket = out.lines[0].cells[1];
    expect(bracket.level % 2).toBe(1);
    expect(bracket.cp).toBe(0x29);
  });

  it('leaves a bracket alone in a left-to-right run', () => {
    const out = layoutRuns([RUN('A(B')], OPTS);
    expect(out.lines[0].cells[1].cp).toBe(0x28);
  });

  it('does not mirror with no engine, even in Hebrew', () => {
    const out = layoutRuns([RUN('א(ב')], { ...OPTS, bidi: undefined });
    expect(out.lines[0].cells[1].cp).toBe(0x28);
  });
});
