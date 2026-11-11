/**
 * Properties of `scriptPieces` on mixed text: the pieces tile the text exactly at code point boundaries, each
 * holds the letters of one script, a cut falls only where the script changes, and a piece reads right to left
 * exactly when its script's first strong letter so far does.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bidiClassOf, pairedBracket } from '@weasel-js/bidi';
import { scriptPieces, SCRIPT_NAMES } from './scripts';
import { mixedText, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

const SHARED = /^[\p{Script=Common}\p{Script=Inherited}\p{Script=Unknown}]$/u;
const TESTS = SCRIPT_NAMES.flatMap((name) => {
  try { return [[name, new RegExp(`^\\p{Script=${name}}$`, 'u')] as const]; } catch { return []; }
});

/** The script a character is written in, by a plain search of every name, or null for a shared one. */
function scriptOf(ch: string): string | null {
  if (SHARED.test(ch)) return null;
  for (const [name, test] of TESTS) if (test.test(ch)) return name;
  return null;
}

const isHigh = (u: number): boolean => u >= 0xd800 && u <= 0xdbff;
const isLow = (u: number): boolean => u >= 0xdc00 && u <= 0xdfff;

/** `[offset, character]` for each code point of `text[from, to)`. */
function chars(text: string, from = 0, to = text.length): [number, string][] {
  const out: [number, string][] = [];
  let at = 0;
  for (const ch of text) {
    if (at >= from && at < to) out.push([at, ch]);
    at += ch.length;
  }
  return out;
}

describe('scriptPieces, property', () => {
  it('tiles the text exactly, cutting only between code points', () => {
    const t = tally();
    fc.assert(fc.property(mixedText, (text) => {
      const pieces = scriptPieces(text);
      if (text.length === 0) { expect(pieces).toEqual([]); return; }
      expect(pieces[0]!.start).toBe(0);
      expect(pieces.at(-1)!.end).toBe(text.length);
      for (const [k, p] of pieces.entries()) {
        expect(p.end).toBeGreaterThan(p.start);
        if (k > 0) {
          expect(p.start).toBe(pieces[k - 1]!.end);
          expect(isHigh(text.charCodeAt(p.start - 1)) && isLow(text.charCodeAt(p.start))).toBe(false);
        }
      }
      t.count(pieces.length > 1 ? 'cut' : 'whole');
    }), runs(RUNS));
    t.atLeast('cut', 150);
    t.atLeast('whole', 30);
  }, timeoutFor(RUNS, 2));

  it('holds one script\'s letters per piece and cuts only where the script changes', () => {
    const t = tally();
    fc.assert(fc.property(mixedText, (text) => {
      const pieces = scriptPieces(text);
      const scriptsOf = pieces.map(({ start, end }) => [...new Set(chars(text, start, end).map(([, ch]) => scriptOf(ch)).filter((s) => s !== null))]);
      for (const [k, p] of pieces.entries()) {
        expect(scriptsOf[k]!.length).toBeLessThanOrEqual(1);
        if (k === 0) continue;
        const [[, first]] = chars(text, p.start, p.end) as [[number, string]];
        const own = scriptsOf[k]![0];
        const before = scriptsOf[k - 1]![0];
        if (scriptOf(first) === null) {
          // A piece opening on a shared character opens on a closing bracket, which took its opener's script.
          expect(pairedBracket(first.codePointAt(0)!)?.kind).toBe('close');
          t.count('bracket cut');
        } else if (before !== undefined) {
          expect(own).not.toBe(before);
          t.count('script cut');
        }
      }
    }), runs(RUNS));
    t.atLeast('script cut', 300);
    t.atLeast('bracket cut', 40);
  }, timeoutFor(RUNS, 3));

  it('reads a piece right to left exactly when its script\'s first strong letter so far does', () => {
    const t = tally();
    fc.assert(fc.property(mixedText, (text) => {
      const firstStrong = new Map<string, boolean>();
      const all = chars(text);
      let next = 0;
      for (const p of scriptPieces(text)) {
        for (; next < all.length && all[next]![0] < p.end; next++) {
          const ch = all[next]![1];
          const s = scriptOf(ch);
          if (s === null || firstStrong.has(s)) continue;
          const c = bidiClassOf(ch.codePointAt(0)!);
          if (c === 'L') firstStrong.set(s, false);
          else if (c === 'R' || c === 'AL') firstStrong.set(s, true);
        }
        const own = chars(text, p.start, p.end).map(([, ch]) => scriptOf(ch)).find((s) => s !== null);
        if (own === undefined || own === null) continue;
        expect(p.rtl).toBe(firstStrong.get(own) ?? false);
        t.count(p.rtl ? 'rtl' : 'ltr');
      }
    }), runs(RUNS));
    t.atLeast('rtl', 150);
    t.atLeast('ltr', 150);
  }, timeoutFor(RUNS, 3));
});
