/**
 * Properties of the analysis half, rules P through I, on paragraphs of any code points. The conformance
 * files pin each case's levels; these check what holds across all of them: levels inside BD2's bound, every
 * kept character resolved to a direction, `'auto'` as whichever direction it reports, text with nothing
 * right to left left alone, and an isolate's contents resolving as their own paragraph would.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { analyze } from './index';
import { resolveExplicit, MAX_DEPTH } from './explicit';
import { bidiClassOf } from './tables';
import {
  BY_CLASS, deepParagraph, direction, ofClasses, paragraph, runs, tally, timeoutFor,
} from './pbt.fixture';
import type { BidiClass } from './types';

const RUNS = 400;

const RESOLVED = new Set<BidiClass>(['L', 'R', 'EN', 'AN']);

describe('analyze, property', () => {
  it('keeps every array aligned, explicit levels within BD2, and resolved ones within a step or two above', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(paragraph(), deepParagraph), direction, (cps, dir) => {
      const a = analyze(cps, dir);
      const x = resolveExplicit(cps.map(bidiClassOf), a.paragraphLevel);
      expect(a.levels.length).toBe(cps.length);
      expect(a.classes.length).toBe(cps.length);
      expect(a.removed.length).toBe(cps.length);
      expect(a.original).toEqual(cps.map(bidiClassOf));
      expect(a.removed).toEqual(x.removed);
      if (dir !== 'auto') expect(a.paragraphLevel).toBe(dir === 'rtl' ? 1 : 0);
      let deepest = 0;
      for (let i = 0; i < cps.length; i++) {
        deepest = Math.max(deepest, x.levels[i]!);
        expect(x.levels[i]).toBeLessThanOrEqual(MAX_DEPTH);
        expect(x.levels[i]).toBeGreaterThanOrEqual(a.paragraphLevel);
        if (a.removed[i]) {
          expect(a.levels[i]).toBe(x.levels[i]);
          continue;
        }
        expect(a.levels[i]).toBeGreaterThanOrEqual(x.levels[i]!);
        expect(a.levels[i]).toBeLessThanOrEqual(x.levels[i]! + 2);
        expect(a.levels[i]).toBeLessThanOrEqual(MAX_DEPTH + 1);
        expect(RESOLVED.has(a.classes[i]!)).toBe(true);
        // I1/I2: only R reads right to left; L and both number classes land on an even level.
        expect(a.levels[i]! % 2 === 1).toBe(a.classes[i] === 'R');
      }
      t.count(cps.length === 0 ? 'empty' : 'text');
      if (deepest >= MAX_DEPTH - 1) t.count('at MAX_DEPTH');
      if (deepest >= 20) t.count('deep');
    }), runs(RUNS));
    t.atLeast('empty', 3);
    t.atLeast('text', 200);
    t.atLeast('deep', 40);
    t.atLeast('at MAX_DEPTH', 10);
  }, timeoutFor(RUNS, 5));

  it('resolves under auto exactly as under the direction auto reports', () => {
    const t = tally();
    fc.assert(fc.property(paragraph(), (cps) => {
      const auto = analyze(cps, 'auto');
      const fixed = analyze(cps, auto.paragraphLevel === 1 ? 'rtl' : 'ltr');
      expect(auto).toEqual(fixed);
      t.count(auto.paragraphLevel === 1 ? 'rtl' : 'ltr');
    }), runs(RUNS));
    t.atLeast('rtl', 15);
    t.atLeast('ltr', 40);
  }, timeoutFor(RUNS, 2));

  it('leaves text with nothing right to left, no Arabic number, and no formatting code at level 0', () => {
    const ltrOnly = fc.array(ofClasses(['L', 'EN', 'ES', 'ET', 'CS', 'NSM', 'BN', 'B', 'S', 'WS', 'ON']), { maxLength: 40 });
    const t = tally();
    fc.assert(fc.property(ltrOnly, fc.constantFrom('ltr' as const, 'auto' as const), (cps, dir) => {
      const a = analyze(cps, dir);
      expect(a.paragraphLevel).toBe(0);
      expect([...a.levels]).toEqual(cps.map(() => 0));
      if (cps.some((cp) => BY_CLASS.EN.includes(cp))) t.count('numbers');
    }), runs(RUNS));
    t.atLeast('numbers', 40);
  }, timeoutFor(RUNS, 2));

  it('puts right-to-left letters among neutrals all at level 1 in a right-to-left paragraph', () => {
    const rtlOnly = fc.array(ofClasses(['R', 'AL', 'NSM', 'WS', 'ON', 'S', 'CS', 'ES', 'ET', 'BN', 'B']), { maxLength: 40 });
    fc.assert(fc.property(rtlOnly, (cps) => {
      const a = analyze(cps, 'rtl');
      for (let i = 0; i < cps.length; i++) if (!a.removed[i]) expect(a.levels[i]).toBe(1);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

const NOT_B = Object.keys(BY_CLASS).filter((c) => c !== 'B') as BidiClass[];
const part = fc.array(ofClasses(NOT_B), { maxLength: 24 });
const PDI = 0x2069;
const ISOLATES = new Set<BidiClass>(['LRI', 'RLI', 'FSI']);

/** `cps` with every PDI it cannot match dropped and a PDI closing each initiator left open. */
function balanced(cps: readonly number[]): number[] {
  const out: number[] = [];
  let open = 0;
  for (const cp of cps) {
    const c = bidiClassOf(cp);
    if (c === 'PDI') {
      if (open === 0) continue;
      open--;
    } else if (ISOLATES.has(c)) {
      open++;
    }
    out.push(cp);
  }
  while (open-- > 0) out.push(PDI);
  return out;
}

const nextOf = (level: number, rtl: boolean): number => (level + 1) % 2 === (rtl ? 1 : 0) ? level + 1 : level + 2;

describe('analyze, isolates, property', () => {
  it('resolves an isolate\'s contents as their own paragraph, moved up to the isolate\'s level', () => {
    const t = tally();
    const initiator = fc.constantFrom(0x2066, 0x2067, 0x2068);
    fc.assert(fc.property(part, part, part, initiator, direction, (p, inner, q, open, dir) => {
      const before = balanced(p);
      const body = balanced(inner);
      const after = q;
      const whole = [...before, open, ...body, PDI, ...after];
      const a = analyze(whole, dir);
      const initAt = before.length;
      const x = resolveExplicit(whole.map(bidiClassOf), a.paragraphLevel);
      if (Math.max(...x.levels) > MAX_DEPTH - 4) return;
      const ownDir = open === 0x2066 ? 'ltr' : open === 0x2067 ? 'rtl' : 'auto';
      const own = analyze(body, ownDir);
      const base = nextOf(x.levels[initAt]!, own.paragraphLevel === 1);
      const shift = base - own.paragraphLevel;
      for (let i = 0; i < body.length; i++) {
        expect(a.removed[initAt + 1 + i]).toBe(own.removed[i]);
        expect(a.levels[initAt + 1 + i]).toBe(own.levels[i]! + shift);
      }
      t.count(ownDir);
      if (body.length > 0 && shift > 1) t.count('nested deeper');
    }), runs(RUNS));
    t.atLeast('ltr', 50);
    t.atLeast('rtl', 50);
    t.atLeast('auto', 50);
    t.atLeast('nested deeper', 30);
  }, timeoutFor(RUNS, 4));

  it('resolves the text around an isolate as if it were two neutrals', () => {
    const t = tally();
    const initiator = fc.constantFrom(0x2066, 0x2067, 0x2068);
    fc.assert(fc.property(part, part, part, initiator, direction, (p, inner, q, open, dir) => {
      const before = balanced(p);
      const body = balanced(inner);
      const a = analyze([...before, open, ...body, PDI, ...q], dir);
      const plain = analyze([...before, 0x21, 0x21, ...q], dir);
      expect(a.paragraphLevel).toBe(plain.paragraphLevel);
      const outside = (i: number): number => (i <= before.length ? i : i + body.length);
      for (let i = 0; i < plain.levels.length; i++) {
        expect(a.levels[outside(i)]).toBe(plain.levels[i]);
      }
      if (before.length > 0 && q.length > 0) t.count('between');
    }), runs(RUNS));
    t.atLeast('between', 100);
  }, timeoutFor(RUNS, 4));
});
