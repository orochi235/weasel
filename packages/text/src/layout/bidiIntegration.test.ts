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
  fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
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

  it('draws a mirror only the fallback tier has from the fallback tier\'s atlas', async () => {
    // An atlas with `(` and no `)`: the mirrored bracket has to come from the
    // dynamic tier, and its quad belongs with that tier's glyphs.
    const half = {
      ...FIXTURE_FONT,
      chars: [...FIXTURE_FONT.chars, { id: 0x28, x: 50, y: 0, width: 8, height: 28, xoffset: 1, yoffset: 4, xadvance: 10, page: 0 }],
    };
    const prior = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(half) })
      : (prior as (u: string) => Promise<Response>)(url))) as typeof fetch;
    await registerFont('half', {}, '/half.json', '/half.png');
    global.fetch = prior;

    const out = layoutRuns([{ ...RUN('א(ב'), fontFamily: 'half' }], OPTS);
    expect(out.lines[0].cells[1].cp).toBe(0x29);
    expect(out.groups.filter((g) => g.source === 'atlas')).toEqual([]);
    expect(out.groups.find((g) => g.source === 'canvas')!.quads).toHaveLength(3);
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

describe('paragraphs', () => {
  /** Cell indices of `line`, sorted by where they were painted. */
  const visualOf = (text: string, line: number, opts: LayoutRunsOpts = OPTS) => {
    const cells = layoutRuns([RUN(text)], opts).lines[line].cells;
    return { cells, order: cells.map((_, i) => i).sort((a, b) => cells[a].x - cells[b].x) };
  };

  it('resolves a neutral opening a line against its own paragraph, not the one above', () => {
    // Line 2 is `! אבג` in a left-to-right paragraph: `!` sits between the
    // paragraph start and Hebrew, so it takes the paragraph direction and
    // stays at the left; the Hebrew after it reads right to left.
    const { cells, order } = visualOf('אבג\n! אבג', 1, { ...OPTS, direction: 'ltr' });
    expect(cells.map((c) => c.level)).toEqual([0, 0, 1, 1, 1]);
    expect(order).toEqual([0, 1, 4, 3, 2]);
  });

  it('ends an unclosed override at the paragraph break', () => {
    const { cells, order } = visualOf('‮abc\nxyz', 1);
    expect(cells.map((c) => c.level)).toEqual([0, 0, 0]);
    expect(order).toEqual([0, 1, 2]);
  });

  it('picks each paragraph\'s direction from its own first strong character', () => {
    // Arabic `سلام` then Latin: the first paragraph is right-to-left, the
    // second left-to-right.
    const first = visualOf('سلام\nabc', 0);
    expect(first.order).toEqual([3, 2, 1, 0]);
    const second = visualOf('سلام\nabc.', 1);
    // In a right-to-left paragraph the full stop would move to the left of
    // `abc`; in its own left-to-right one it stays last.
    expect(second.order).toEqual([0, 1, 2, 3]);
  });

  it('still reorders the first paragraph across CRLF', () => {
    expect(visualOf('אבג\r\nדה', 0).order).toEqual([2, 1, 0]);
    expect(visualOf('אבג\r\nדה', 1).order).toEqual([1, 0]);
  });
});

describe('characters the engine removes', () => {
  it('keeps a zero-width joiner between its neighbors in a left-to-right line', () => {
    const cells = layoutRuns([RUN('AB‍C')], OPTS).lines[0].cells;
    expect(cells[2].x).toBeGreaterThanOrEqual(cells[1].x + cells[1].advance);
    expect(cells[2].x).toBeLessThanOrEqual(cells[3].x);
  });

  it('keeps one between its neighbors in a right-to-left line', () => {
    // Logical א ZWJ ב ג paints, left to right, as ג ב ZWJ א.
    const cells = layoutRuns([RUN('א‍בג')], OPTS).lines[0].cells;
    expect(cells[1].x).toBeGreaterThanOrEqual(cells[2].x + cells[2].advance);
    expect(cells[1].x).toBeLessThanOrEqual(cells[0].x);
  });

  it('places one opening the line at the line\'s start', () => {
    const cells = layoutRuns([RUN('‍AB')], OPTS).lines[0].cells;
    expect(cells[0].x).toBeLessThanOrEqual(cells[1].x);
  });
});

describe('a wrapped right-to-left line', () => {
  const RTL: LayoutRunsOpts = { ...OPTS, direction: 'rtl', align: 'right' };
  /** A box that fits `אבג ` and part of the next word, so the text wraps once. */
  const boxFor = (text: string): number => {
    const cells = layoutRuns([RUN(text)], { ...RTL, maxWidth: Infinity }).lines[0].cells;
    return cells.slice(0, 4).reduce((w, c) => w + c.advance, 0) + cells[4].advance / 2;
  };

  it('hangs the space that ends it off the left, with its ink flush right', () => {
    const text = 'אבג דהו';
    const maxWidth = boxFor(text);
    const out = layoutRuns([RUN(text)], { ...RTL, maxWidth });
    expect(out.lines).toHaveLength(2);
    const [word, space] = [out.lines[0].cells.slice(0, 3), out.lines[0].cells[3]];
    expect(space.cp).toBe(32);
    expect(Math.max(...word.map((c) => c.x + c.advance))).toBeCloseTo(maxWidth, 6);
    expect(space.x + space.advance).toBeCloseTo(Math.min(...word.map((c) => c.x)), 6);
    // The last line has no space to hang and ends at the same edge.
    const last = out.lines[1].cells;
    expect(Math.max(...last.map((c) => c.x + c.advance))).toBeCloseTo(maxWidth, 6);
  });

  it('starts its ink at the left edge when aligned left', () => {
    const text = 'אבג דהו';
    const out = layoutRuns([RUN(text)], { ...RTL, align: 'left', maxWidth: boxFor(text) });
    const word = out.lines[0].cells.slice(0, 3);
    expect(Math.min(...word.map((c) => c.x))).toBeCloseTo(0, 6);
  });

  it('still hangs a trailing space off the right in a left-to-right paragraph', () => {
    const out = layoutRuns([RUN('AB CD')], { ...OPTS, align: 'right', maxWidth: 400 });
    const cells = out.lines[0].cells;
    expect(cells[4].x + cells[4].advance).toBeCloseTo(400, 6);
  });
});
