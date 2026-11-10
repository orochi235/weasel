/**
 * Properties of `layoutRuns` over mixed-script text cut into runs of several sizes: the cells account for
 * every source character but the hard breaks, a line overflows only when it holds no opportunity, and a wider
 * box never makes more lines.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns, type LaidOutRuns } from './layoutRuns';
import { NO_BREAK, isHardLineBreak, lineBreakOpportunities } from './lineBreak/lineBreaks';
import { RUN_PLAIN } from './testing/fontFixtures';
import type { ResolvedRun } from '../runs/resolveRuns';
import { cutInto, mixedText, propertyAtlas, runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 150;

beforeAll(async () => {
  _resetFontRegistryForTests();
  const font = propertyAtlas(FIXTURE_FONT);
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(font) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const styledRuns = fc.record({
  text: mixedText(18),
  cuts: fc.array(fc.nat(), { maxLength: 4 }),
  sizes: fc.array(fc.constantFrom(16, 32, 48), { minLength: 1, maxLength: 4 }),
  tracking: fc.array(fc.constantFrom(0, 0, 3), { minLength: 1, maxLength: 4 }),
}).map(({ text, cuts, sizes, tracking }) => ({
  text,
  runs: cutInto(text, cuts).map((t, i): ResolvedRun => ({
    ...RUN_PLAIN(t), fontSize: sizes[i % sizes.length]!, letterSpacing: tracking[i % tracking.length]!,
  })),
}));

const lay = (rs: readonly ResolvedRun[], maxWidth: number): LaidOutRuns =>
  layoutRuns(rs, { align: 'left', maxWidth, lineHeight: 1.2 });

/** Each code point's UTF-16 offset, and its index by offset. */
function offsets(text: string): { cps: number[]; at: number[]; index: Map<number, number> } {
  const cps: number[] = [];
  const at: number[] = [];
  const index = new Map<number, number>();
  let u = 0;
  for (const ch of text) {
    index.set(u, cps.length);
    cps.push(ch.codePointAt(0)!);
    at.push(u);
    u += ch.length;
  }
  return { cps, at, index };
}

const isHang = (cp: number): boolean => cp === 32 || cp === 9;

describe('layoutRuns, property', () => {
  it('gives every source code point but the hard breaks one cell, in order, on its own source span', () => {
    const t = tally();
    fc.assert(fc.property(styledRuns, fc.integer({ min: 20, max: 400 }), ({ text, runs: rs }, maxWidth) => {
      const { cps, at } = offsets(text);
      const laid = lay(rs, maxWidth);
      const cells = laid.lines.flatMap((l) => l.cells);
      const kept = cps.map((cp, i) => ({ cp, at: at[i]! })).filter(({ cp }) => !isHardLineBreak(cp));
      expect(cells.map((c) => c.cp), JSON.stringify(text)).toEqual(kept.map((k) => k.cp));
      cells.forEach((c, i) => {
        expect(c.srcIndex).toBe(kept[i]!.at);
        expect(text.slice(c.srcIndex, c.srcEnd)).toBe(String.fromCodePoint(c.cp));
        expect(Number.isFinite(c.x) && Number.isFinite(c.advance)).toBe(true);
      });
      for (const l of laid.lines) {
        expect(l.srcEnd).toBe(l.cells.length > 0 ? l.cells[l.cells.length - 1]!.srcEnd : l.srcEnd);
        expect(l.srcEnd >= 0 && l.srcEnd <= text.length).toBe(true);
      }
      if (laid.lines.length > 1) t.count('lines');
    }), runs(RUNS));
    t.atLeast('lines', 30);
  }, timeoutFor(RUNS, 20));

  it('keeps each line within the box unless it holds no break opportunity', () => {
    const t = tally();
    fc.assert(fc.property(styledRuns, fc.integer({ min: 20, max: 400 }), ({ text, runs: rs }, maxWidth) => {
      const { cps, index } = offsets(text);
      const breaks = lineBreakOpportunities(cps);
      for (const l of lay(rs, maxWidth).lines) {
        const ink = l.cells.filter((c) => !isHang(c.cp));
        if (ink.length === 0) continue;
        const right = Math.max(...ink.map((c) => c.x + c.advance));
        const left = l.cells[0]!.x;
        if (right - left <= maxWidth * (1 + 1e-9)) { t.count('fits'); continue; }
        t.count('overfull');
        const first = index.get(l.cells[0]!.srcIndex)!;
        const last = index.get(ink[ink.length - 1]!.srcIndex)!;
        for (let k = first + 1; k <= last; k++) {
          if (cps.slice(first, k).every(isHang)) continue;
          expect(breaks[k], `opportunity at ${k} of ${JSON.stringify(text)} at ${maxWidth}`).toBe(NO_BREAK);
        }
      }
    }), runs(RUNS));
    t.atLeast('fits', 30);
    t.atLeast('overfull', 5);
  }, timeoutFor(RUNS, 20));

  it('never makes more lines for a wider box', () => {
    const t = tally();
    // A tab runs to a stop counted from the line's start, so a line starting later can be wider: no tabs here.
    const noTabs = styledRuns.map(({ text, runs: rs }) => ({
      text: text.replace(/\t/g, ' '), runs: rs.map((r) => ({ ...r, text: r.text.replace(/\t/g, ' ') })),
    }));
    fc.assert(fc.property(noTabs, fc.integer({ min: 20, max: 300 }), fc.integer({ min: 0, max: 200 }), ({ runs: rs }, w, more) => {
      const narrow = lay(rs, w);
      const wide = lay(rs, w + more);
      expect(wide.lines.length).toBeLessThanOrEqual(narrow.lines.length);
      if (wide.lines.length < narrow.lines.length) t.count('fewer');
      expect(lay(rs, Infinity).lines.length).toBeLessThanOrEqual(wide.lines.length);
      expect(Number.isFinite(narrow.bounds.width) && Number.isFinite(narrow.bounds.height)).toBe(true);
    }), runs(RUNS));
    t.atLeast('fewer', 10);
  }, timeoutFor(RUNS, 30));
});
