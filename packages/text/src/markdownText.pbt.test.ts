/**
 * `layoutMarkdown` over any runs: every figure finite, each line's runs tiling it from 0, the lines holding the
 * source in order with only hanging white space and hard breaks between them, every piece styled as the run it
 * came from, a line past the width only where no break was to be had, and one line per paragraph unwrapped.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { layoutMarkdown, type MarkdownFont, type PositionedRun } from './markdownText';
import type { StyledRun } from './runs';
import { graphemeCount } from './measure/graphemes';
import { isHardLineBreak, lineBreakOpportunities, NO_BREAK } from './layout/lineBreak/lineBreaks';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const SIZE = 16;

/** An additive measure: each code point by its own width, scaled by the font size; a combining mark is 0. */
function measure(text: string, font: MarkdownFont): number {
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (/\p{Mn}/u.test(ch)) continue;
    w += ((cp % 5) + 3 + (cp >= 0x2e80 ? 6 : 0)) * font.fontSize / 10;
  }
  return w;
}

const piece = fc.constantFrom('A', 'B', 'word', 'xy', ' ', '  ', '\t', '-', '­', 'é', '漢字', '👍🏽', 'ß', 'ﬁ', '\n', '\r\n', 'i', 'Σ');
const text = fc.array(piece, { maxLength: 8 }).map((a) => a.join(''));

/** Runs with styling that changes size, tracking, and baseline, but not the text drawn. */
const plainRun: fc.Arbitrary<StyledRun> = fc.record({
  text,
  bold: fc.boolean(),
  italic: fc.boolean(),
  fontScale: fc.constantFrom(0.5, 1, 1.75),
  fontSize: fc.oneof(fc.constant(12), fc.record({ px: fc.constantFrom(9, 20) })),
  letterSpacing: fc.oneof(fc.constant(1.5), fc.constant(-0.75), fc.record({ px: fc.constant(2) })),
  script: fc.constantFrom('super' as const, 'sub' as const),
  baselineShift: fc.constantFrom(0.3, -0.2),
}, { requiredKeys: ['text'] });

/** Runs that may also change the text drawn. */
const anyRun: fc.Arbitrary<StyledRun> = fc.tuple(plainRun, fc.record({
  textTransform: fc.constantFrom('uppercase' as const, 'lowercase' as const, 'capitalize' as const),
  fontVariantCaps: fc.constantFrom('small-caps' as const, 'normal' as const),
  lang: fc.constantFrom('tr', 'el', 'en'),
}, { requiredKeys: [] })).map(([r, extra]) => ({ ...r, ...extra }));

const width = fc.oneof(fc.constant(Infinity), fc.integer({ min: 1, max: 120 }), fc.constant(0));
const opts = fc.record({ letterSpacing: fc.constantFrom(0, 1), tabSize: fc.constantFrom(8, 2, 0) });

/** What may lie between two lines: hanging white space and hard breaks. */
const BETWEEN = /^[ \t\n\r\u000b\u000c\u0085\u2028\u2029]*$/u;

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const lineText = (rs: readonly PositionedRun[]) => rs.map((r) => r.text).join('');

describe('layoutMarkdown, property', () => {
  it('lays every run out finite, each line tiled from 0 by its runs', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(anyRun, { maxLength: 5 }), width, opts, (rs, w, o) => {
      const out = layoutMarkdown(rs, w, SIZE, measure, o);
      let height = 0;
      let widest = 0;
      for (const line of out.lines) {
        let x = 0;
        for (const r of line.runs) {
          for (const v of [r.x, r.y, r.width, r.font.fontSize, r.lineSize, r.tracking]) expect(Number.isFinite(v)).toBe(true);
          expect(close(r.x, x), `${r.x} vs ${x}`).toBe(true);
          x += r.width;
          expect(r.text.length).toBeGreaterThan(0);
          if (r.text !== '\t' && !r.text.endsWith('‐')) {
            expect(close(r.width, measure(r.text, r.font) + (r.tracking === 0 ? 0 : graphemeCount(r.text) * r.tracking))).toBe(true);
          }
        }
        expect(close(line.width, x)).toBe(true);
        expect(line.height).toBeGreaterThan(0);
        height += line.height;
        widest = Math.max(widest, line.width);
        if (line.runs.length > 1) t.count('several');
      }
      expect(close(out.height, height)).toBe(true);
      if (out.lines.length > 0) expect(close(out.width, widest)).toBe(true);
      else expect(out).toEqual({ lines: [], width: 0, height: 0 });
    }), runs(RUNS));
    t.atLeast('several', 100);
  }, timeoutFor(RUNS, 5));

  it('holds the source in order, each piece styled as its run, with only hanging white space and breaks between lines', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(plainRun, { maxLength: 5 }), width, opts, (rs, w, o) => {
      const out = layoutMarkdown(rs, w, SIZE, measure, o);
      const source = rs.map((r) => r.text).join('');
      const runAt: StyledRun[] = rs.flatMap((r) => [...r.text].flatMap((ch) => Array<StyledRun>(ch.length).fill(r)));
      let at = 0;
      for (const line of out.lines) {
        let shown = lineText(line.runs);
        const hyphen = shown.endsWith('‐');
        if (hyphen) shown = `${shown.slice(0, -1)}­`;
        const found = source.indexOf(shown, at);
        expect(found, `${JSON.stringify(shown)} in ${JSON.stringify(source)} from ${at}`).toBeGreaterThanOrEqual(0);
        expect(source.slice(at, found), JSON.stringify(source)).toMatch(BETWEEN);
        let k = found;
        for (const r of line.runs) {
          const from = runAt[k]!;
          expect(r.bold, JSON.stringify(source)).toBe(from.bold);
          expect(r.fontScale).toBe(from.fontScale);
          k += r.text.length;
        }
        at = found + shown.length;
        if (hyphen) t.count('hyphen');
      }
      expect(source.slice(at)).toMatch(BETWEEN);
      if (out.lines.length > 2) t.count('lines');
    }), runs(RUNS));
    t.atLeast('lines', 60);
    t.atLeast('hyphen', 5);
  }, timeoutFor(RUNS, 5));

  it('runs a line past the width only where no break opportunity with ink after it falls inside', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(plainRun, { minLength: 1, maxLength: 5 }), fc.integer({ min: 1, max: 120 }), opts, (rs, w, o) => {
      const out = layoutMarkdown(rs, w, SIZE, measure, o);
      const source = rs.map((r) => r.text).join('');
      const cps = [...source].map((c) => c.codePointAt(0)!);
      const breaks = lineBreakOpportunities(cps);
      const cpAt = new Map<number, number>();
      let u = 0;
      [...source].forEach((c, i) => { cpAt.set(u, i); u += c.length; });
      cpAt.set(source.length, cps.length);
      let at = 0;
      for (const line of out.lines) {
        let shown = lineText(line.runs);
        if (shown.endsWith('‐')) shown = `${shown.slice(0, -1)}­`;
        const found = source.indexOf(shown, at);
        at = found + shown.length;
        if (!(line.width > w * (1 + 1e-9))) continue;
        t.count('over');
        const a = cpAt.get(found)!;
        const b = cpAt.get(at)!;
        for (let k = a + 1; k < b; k++) {
          const inkAfter = cps.slice(k, b).some((cp) => cp !== 32 && cp !== 9 && !isHardLineBreak(cp));
          if (breaks[k] !== NO_BREAK && inkAfter) {
            expect.fail(`${JSON.stringify(shown)} is ${line.width} wide in ${w}, with a break before ${k - a}`);
          }
        }
      }
    }), runs(RUNS));
    t.atLeast('over', 30);
  }, timeoutFor(RUNS, 5));

  it('sets one line per paragraph at no width limit', () => {
    fc.assert(fc.property(fc.array(plainRun, { maxLength: 5 }), (rs) => {
      const cps = [...rs.map((r) => r.text).join('')].map((c) => c.codePointAt(0)!);
      let paragraphs = cps.length > 0 ? 1 : 0;
      cps.forEach((cp, i) => {
        if (isHardLineBreak(cp) && !(cp === 13 && cps[i + 1] === 10) && i < cps.length - 1) paragraphs++;
      });
      expect(layoutMarkdown(rs, Infinity, SIZE, measure).lines).toHaveLength(paragraphs);
    }), runs(RUNS));
  });

  it('raises a superscript and lowers a subscript, measured against the inherited size', () => {
    fc.assert(fc.property(fc.constantFrom('super' as const, 'sub' as const), fc.option(fc.constantFrom(0.3, -0.2), { nil: undefined }), (script, shift) => {
      const out = layoutMarkdown([{ text: 'A', script, ...(shift === undefined ? {} : { baselineShift: shift }) }], Infinity, SIZE, measure);
      const r = out.lines[0]!.runs[0]!;
      const want = shift ?? (script === 'super' ? 1 : -1);
      expect(Math.sign(-r.y)).toBe(Math.sign(want));
      if (shift !== undefined) expect(r.y).toBeCloseTo(-shift * SIZE, 9);
      expect(r.font.fontSize).toBeLessThan(SIZE);
    }), runs(40));
  });
});
