/**
 * Properties of the UAX #14 break opportunities and the greedy wrap over them, on mixed-script text. The
 * conformance file pins each opportunity; these check what the wrap promises about the lines it makes.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BREAK_MANDATORY, NO_BREAK, isHardLineBreak, lineBreakOpportunities } from './lineBreaks';
import { hangs, wrapLines, type WrappedLine } from './wrapLines';
import { codePoints, mixedText, oneLineText, runs, segmenterEnds, tally, timeoutFor } from '../../pbt.fixture';

const RUNS = 300;

/** A width per code point, so a span's width is the sum of its own. */
const advances = fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 8 });
const additive = (cps: readonly number[], adv: readonly number[]) => {
  const w = cps.map((cp, i) => (hangs(cp) ? 8 : adv[(cp + i) % adv.length]!));
  return (start: number, end: number): number => {
    let s = 0;
    for (let k = start; k < end; k++) s += w[k]!;
    return s;
  };
};

const inkEnd = (cps: readonly number[], l: WrappedLine): number => {
  let e = l.end;
  while (e > l.start && hangs(cps[e - 1]!)) e--;
  return e;
};

/** Where the word opening at `from` ends its ink: the next opportunity, hard break, or the end. */
function wordInk(cps: readonly number[], breaks: Uint8Array, from: number): number {
  let ink = from + 1;
  for (let j = from + 1; j < cps.length && !isHardLineBreak(cps[j]!) && breaks[j] === NO_BREAK; j++) {
    if (!hangs(cps[j]!)) ink = j + 1;
  }
  return ink;
}

describe('lineBreakOpportunities, property', () => {
  it('ends a line after every hard break and at the end, and nowhere else must', () => {
    const t = tally();
    fc.assert(fc.property(mixedText(), (text) => {
      const cps = codePoints(text);
      const b = lineBreakOpportunities(cps);
      expect(b.length).toBe(cps.length + 1);
      if (cps.length === 0) return;
      expect(b[0]).toBe(NO_BREAK);
      expect(b[cps.length]).toBe(BREAK_MANDATORY);
      for (let i = 1; i < cps.length; i++) {
        const prev = cps[i - 1]!;
        const must = isHardLineBreak(prev) && !(prev === 13 && cps[i] === 10);
        if (must) t.count('hard');
        expect(b[i] === BREAK_MANDATORY, `at ${i} of ${JSON.stringify(text)}`).toBe(must);
      }
    }), runs(RUNS));
    t.atLeast('hard', 20);
  });

  it('decides each side of a newline as it would alone', () => {
    const t = tally();
    fc.assert(fc.property(mixedText(10), mixedText(10), (a, b) => {
      fc.pre(!a.endsWith('\r'));
      const ca = codePoints(a);
      const cb = codePoints(b);
      const whole = lineBreakOpportunities([...ca, 10, ...cb]);
      const left = lineBreakOpportunities(ca);
      const right = lineBreakOpportunities(cb);
      for (let i = 0; i < ca.length; i++) expect(whole[i], `left ${i}`).toBe(left[i]);
      if (ca.length > 0) expect(whole[ca.length]).toBe(isHardLineBreak(ca[ca.length - 1]!) ? BREAK_MANDATORY : NO_BREAK);
      expect(whole[ca.length + 1]).toBe(BREAK_MANDATORY);
      for (let i = 1; i <= cb.length; i++) expect(whole[ca.length + 1 + i], `right ${i}`).toBe(right[i]);
      if (ca.length > 0 && cb.length > 1) t.count('both');
    }), runs(RUNS));
    t.atLeast('both', 50);
  });

  it('never breaks inside a grapheme cluster that opens on a letter', () => {
    const t = tally();
    fc.assert(fc.property(oneLineText(), (text) => {
      const cps = codePoints(text);
      const b = lineBreakOpportunities(cps);
      const ends = new Set(segmenterEnds(text));
      let unit = 0;
      let clusterOpen = 0;
      for (let i = 0; i < cps.length; i++) {
        if (i > 0 && !ends.has(unit)) {
          // UAX #14 itself lets a line break between a space (or a control) and a mark set on it.
          const opener = cps[clusterOpen]!;
          if (/[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(String.fromCodePoint(opener))) {
            t.count('inside');
            expect(b[i], `at ${i} of ${JSON.stringify(text)}`).toBe(NO_BREAK);
          }
        } else {
          clusterOpen = i;
        }
        unit += cps[i]! > 0xffff ? 2 : 1;
      }
    }), runs(RUNS));
    t.atLeast('inside', 50);
  });
});

describe('wrapLines, property', () => {
  /** Spaces opening a paragraph hang, so the wrap reads them apart from the rest: open on some often. */
  const text = fc.tuple(fc.constantFrom('', '', ' ', '\t ', '\n  '), mixedText(20)).map(([lead, t]) => lead + t);
  const input = fc.record({ text, adv: advances, maxWidth: fc.integer({ min: 1, max: 300 }) });

  it('tiles the text with its lines, leaving out only the hard breaks', () => {
    fc.assert(fc.property(input, ({ text, adv, maxWidth }) => {
      const cps = codePoints(text);
      const lines = wrapLines(cps, maxWidth, additive(cps, adv));
      let at = 0;
      for (const l of lines) {
        while (at < l.start) {
          expect(isHardLineBreak(cps[at]!) || (cps[at] === 10 && cps[at - 1] === 13), `gap at ${at}`).toBe(true);
          at++;
        }
        expect(l.start).toBe(at);
        expect(l.end).toBeGreaterThanOrEqual(l.start);
        for (let k = l.start; k < l.end; k++) expect(isHardLineBreak(cps[k]!)).toBe(false);
        at = l.end;
      }
      for (; at < cps.length; at++) expect(isHardLineBreak(cps[at]!) || cps[at] === 10).toBe(true);
    }), runs(RUNS));
  });

  it('wraps only at an opportunity, fits each line unless one word is too wide, and fills it greedily', () => {
    const t = tally();
    fc.assert(fc.property(input, ({ text, adv, maxWidth }) => {
      const cps = codePoints(text);
      const width = additive(cps, adv);
      const breaks = lineBreakOpportunities(cps);
      const lines = wrapLines(cps, maxWidth, width);
      for (let n = 0; n < lines.length; n++) {
        const l = lines[n]!;
        const ink = inkEnd(cps, l);
        if (l.wrapped) {
          t.count('wrapped');
          expect(breaks[l.end], `wrap at ${l.end} of ${JSON.stringify(text)}`).not.toBe(NO_BREAK);
          const next = lines[n + 1]!;
          expect(next.start).toBe(l.end);
          expect(width(l.start, wordInk(cps, breaks, next.start)), 'the next word would have fit').toBeGreaterThan(maxWidth);
        }
        if (ink > l.start && width(l.start, ink) > maxWidth) {
          t.count('overfull');
          for (let k = l.start + 1; k < ink; k++) {
            const leading = cps.slice(l.start, k).every(hangs);
            if (!leading) expect(breaks[k], `unused opportunity at ${k} of ${JSON.stringify(text)}`).toBe(NO_BREAK);
          }
        }
      }
    }), runs(RUNS));
    t.atLeast('wrapped', 50);
    t.atLeast('overfull', 10);
  });

  it('never makes more lines for a wider box', () => {
    fc.assert(fc.property(input, fc.integer({ min: 0, max: 200 }), ({ text, adv, maxWidth }, more) => {
      const cps = codePoints(text);
      const width = additive(cps, adv);
      const narrow = wrapLines(cps, maxWidth, width).length;
      expect(wrapLines(cps, maxWidth + more, width).length).toBeLessThanOrEqual(narrow);
    }), runs(RUNS));
  });

  it('breaks only at hard breaks in an unbounded box', () => {
    fc.assert(fc.property(input, ({ text, adv }) => {
      const cps = codePoints(text);
      const lines = wrapLines(cps, Infinity, additive(cps, adv));
      expect(lines.every((l) => !l.wrapped)).toBe(true);
      const paragraphs = text.split(/\r\n|[\n\r\u000b\u000c\u0085\u2028\u2029]/);
      const expected = text.length > 0 && /(\r\n|[\n\r\u000b\u000c\u0085\u2028\u2029])$/.test(text) ? paragraphs.length - 1 : paragraphs.length;
      expect(lines.length).toBe(text.length === 0 ? 0 : expected);
    }), { ...runs(RUNS) });
  }, timeoutFor(RUNS, 2));
});
