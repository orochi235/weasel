import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setFontFallbackPolicy } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { LayoutRunsOpts } from './layoutOpts';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { resolveTextStyle } from '../textStyle';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — one cell per code point', () => {
  // The fixture atlas carries only 'A' and 'B'. Under the default 'canvas'
  // policy the dynamic tier serves anything else, which hides the drop; 'none'
  // is the configuration a consumer registering its own outlines runs in.
  async function registerBareFixture(): Promise<void> {
    await registerFixture('inter', [{}]);
    setFontFallbackPolicy('none');
  }

  it('keeps a cell for a code point the face cannot serve', async () => {
    await registerBareFixture();
    const out = layoutAndPaint([RUN_PLAIN('ACB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const cells = out.lines[0].cells;
    expect(cells.map((c) => c.cp)).toEqual([65, 67, 66]);
    expect(cells[1].drawsInk).toBe(false);
  });

  it('gives an unservable code point no advance', async () => {
    await registerBareFixture();
    const out = layoutAndPaint([RUN_PLAIN('ACB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const cells = out.lines[0].cells;
    // 'C' occupies a slot but no width, so 'B' sits exactly where it would
    // have without it.
    expect(cells[2].x).toBeCloseTo(cells[1].x, 10);
  });

  it('keeps a cell for a space at the start of the text', async () => {
    await registerBareFixture();
    const out = layoutAndPaint([RUN_PLAIN(' AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const cells = out.lines[0].cells;
    expect(cells.map((c) => c.cp)).toEqual([32, 65, 66]);
    expect(cells[0].x).toBeCloseTo(0, 10);
    expect(cells[1].x).toBeGreaterThan(0);
    expect(cells[1].x).toBeCloseTo(cells[0].advance, 10);
  });

  it('indents by every leading space, at the width a space has mid-line', async () => {
    await registerBareFixture();
    const opts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' } as const;
    const mid = layoutAndPaint([RUN_PLAIN('A B')], opts).lines[0].cells;
    const space = mid[2].x - mid[1].x;
    expect(space).toBeGreaterThan(0);
    for (const n of [1, 2, 3]) {
      const out = layoutAndPaint([RUN_PLAIN(' '.repeat(n) + 'AB')], opts);
      expect(out.lines[0].cells[n].x).toBeCloseTo(n * space, 10);
      expect(out.bounds.width).toBeCloseTo(n * space + layoutAndPaint([RUN_PLAIN('AB')], opts).bounds.width, 10);
    }
  });

  it('keeps a cell for a space at the start of a line after a newline', async () => {
    await registerBareFixture();
    const out = layoutAndPaint([RUN_PLAIN('AB\n AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.lines).toHaveLength(2);
    expect(out.lines[1].cells.map((c) => c.cp)).toEqual([32, 65, 66]);
    expect(out.lines[1].cells[1].x).toBeCloseTo(out.lines[1].cells[0].advance, 10);
    expect(out.lines[1].cells[1].x).toBeGreaterThan(0);
  });

  it('reports which cells drew ink', async () => {
    await registerBareFixture();
    const out = layoutAndPaint([RUN_PLAIN('A B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    expect(out.lines[0].cells.map((c) => c.drawsInk)).toEqual([true, false, true]);
  });

  it('gives every code point on a line exactly one cell, wrapped or not', async () => {
    await registerBareFixture();
    for (const [text, maxWidth] of [
      ['AB', Infinity],
      ['ACB', Infinity],
      [' AB', Infinity],
      ['AB\n AB', Infinity],
      ['AAAA BBBB', 100],
      ['AAAA  BBBB', 100],
      ['A  B', Infinity],
      ['AB ', Infinity],
      ['A\u{1F600}B', Infinity],
    ] as Array<[string, number]>) {
      const out = layoutAndPaint([RUN_PLAIN(text)], { maxWidth, lineHeight: 1.2, align: 'left' });
      const cells = out.lines.reduce((n, l) => n + l.cells.length, 0);
      // A newline separates cells rather than being one.
      const expected = [...text].filter((c) => c !== '\n').length;
      expect(cells, `${JSON.stringify(text)} @ ${maxWidth}`).toBe(expected);
    }
  });

  it('numbers cells by code point while srcIndex stays UTF-16', async () => {
    await registerBareFixture();
    const out = layoutAndPaint([RUN_PLAIN('A\u{1F600}B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const cells = out.lines[0].cells;
    expect(cells).toHaveLength(3);
    expect(cells.map((c) => c.srcIndex)).toEqual([0, 1, 3]);
    expect(cells[1].srcEnd).toBe(3);
  });

  it('maps cells a transform expanded back to their one source character', async () => {
    await registerBareFixture();
    const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 32 });
    const runs = resolveRuns([{ text: 'Aß', textTransform: 'uppercase' }, { text: 'B' }], style);
    const out = layoutAndPaint(runs, { maxWidth: Infinity, lineHeight: 1.2, align: 'left' });
    const cells = out.lines[0].cells;
    expect(cells.map((c) => String.fromCodePoint(c.cp)).join('')).toBe('ASSB');
    expect(cells.map((c) => [c.srcIndex, c.srcEnd])).toEqual([[0, 1], [1, 2], [1, 2], [2, 3]]);
    expect(out.lines[0].srcEnd).toBe(3);
  });
});

describe('layoutRuns — a cell says whether it closes a grapheme cluster', () => {
  const OPTS: LayoutRunsOpts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' };
  const closes = (text: string, more: Partial<ResolvedRun> = {}): boolean[] => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = layoutAndPaint([{ ...RUN_PLAIN(text), ...more }], OPTS);
    warn.mockRestore();
    return out.lines[0].cells.map((c) => c.clusterEnd);
  };

  it('closes one at every code point of plain text', async () => {
    await registerFixture('inter', [{}]);
    expect(closes('AB A')).toEqual([true, true, true, true]);
  });

  it('holds a combining mark open onto its base, tracked or not', async () => {
    await registerFixture('inter', [{}]);
    expect(closes('A\u0301B')).toEqual([false, true, true]);
    expect(closes('A\u0301B', { letterSpacing: 2 })).toEqual([false, true, true]);
  });

  it('keeps a joined emoji and a flag as one cluster each', async () => {
    await registerFixture('inter', [{}]);
    // Man, ZWJ, woman: three code points. Two regional indicators: one flag.
    expect(closes('\u{1F468}\u200D\u{1F469}A')).toEqual([false, false, true, true]);
    expect(closes('\u{1F1E8}\u{1F1E6}')).toEqual([false, true]);
  });
});
