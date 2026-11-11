/**
 * Properties of L1 and L2 over a paragraph wrapped at random: each line's order is a permutation of its kept
 * characters with an inverse, L1 moves only separators and the whitespace and isolate codes before one or at
 * the line's end, and two logical neighbors at one level stay visual neighbors, in reading order on an even
 * level and swapped on an odd one.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { analyze, reorder, type BidiAnalysis } from './index';
import { ofClasses, paragraph, direction, runs, tally, timeoutFor } from './pbt.fixture';
import type { BidiClass } from './types';

const RUNS = 400;

const RESETTABLE = new Set<BidiClass>(['WS', 'FSI', 'LRI', 'RLI', 'PDI']);

/** A paragraph, its analysis, and the line ends a wrap cut it at. */
const wrapped = fc.tuple(paragraph(60), direction).chain(([cps, dir]) => fc.record({
  cps: fc.constant(cps),
  a: fc.constant(analyze(cps, dir)),
  cuts: fc.uniqueArray(fc.integer({ min: 0, max: cps.length }), { maxLength: 5 }).map((c) => c.sort((x, y) => x - y)),
}));

function lines(len: number, cuts: readonly number[]): [number, number][] {
  const ends = [...cuts.filter((c) => c > 0 && c < len), len];
  const out: [number, number][] = [];
  let at = 0;
  for (const e of ends) { if (e > at || len === 0) out.push([at, e]); at = e; }
  return out;
}

describe('reorder, property', () => {
  it('orders each line as a permutation of its kept characters, with an inverse', () => {
    const t = tally();
    fc.assert(fc.property(wrapped, ({ cps, a, cuts }) => {
      const seen: number[] = [];
      for (const [s, e] of lines(cps.length, cuts)) {
        const { order, levels } = reorder(a, s, e);
        expect(levels.length).toBe(e - s);
        const kept: number[] = [];
        for (let i = s; i < e; i++) {
          if (a.removed[i]) expect(levels[i - s]).toBe(-1);
          else kept.push(i);
        }
        expect([...order].sort((x, y) => x - y)).toEqual(kept);
        const inverse = new Map(order.map((i, v) => [i, v]));
        for (const i of kept) expect(order[inverse.get(i)!]).toBe(i);
        order.forEach((i, v) => expect(inverse.get(i)).toBe(v));
        seen.push(...order);
        if (order.some((i, v) => i !== kept[v])) t.count('moved');
      }
      expect(seen.sort((x, y) => x - y)).toEqual(cps.flatMap((_, i) => (a.removed[i] ? [] : [i])));
      t.count(lines(cps.length, cuts).length > 1 ? 'wrapped' : 'one line');
    }), runs(RUNS));
    t.atLeast('moved', 100);
    t.atLeast('wrapped', 100);
  }, timeoutFor(RUNS, 3));

  it('resets only separators and the whitespace leading into one or ending the line, to the paragraph level', () => {
    const t = tally();
    fc.assert(fc.property(wrapped, ({ cps, a, cuts }) => {
      for (const [s, e] of lines(cps.length, cuts)) {
        const { levels } = reorder(a, s, e);
        const kept: number[] = [];
        for (let i = s; i < e; i++) if (!a.removed[i]) kept.push(i);
        const reset = new Array<boolean>(kept.length).fill(false);
        let trailing = true;
        let beforeSeparator = false;
        for (let k = kept.length - 1; k >= 0; k--) {
          const c = a.original[kept[k]!]!;
          if (c === 'S' || c === 'B') { reset[k] = true; beforeSeparator = true; continue; }
          if (RESETTABLE.has(c) && (trailing || beforeSeparator)) { reset[k] = true; continue; }
          trailing = false;
          beforeSeparator = false;
        }
        kept.forEach((i, k) => {
          const want = reset[k] ? a.paragraphLevel : a.levels[i];
          expect(levels[i - s]).toBe(want);
          if (reset[k] && a.levels[i] !== a.paragraphLevel) t.count('reset moved');
        });
      }
    }), runs(RUNS));
    t.atLeast('reset moved', 50);
  }, timeoutFor(RUNS, 3));

  it('keeps two logical neighbors at one level side by side, swapped when the level is odd', () => {
    const t = tally();
    fc.assert(fc.property(wrapped, ({ cps, a, cuts }) => {
      for (const [s, e] of lines(cps.length, cuts)) {
        const { order, levels } = reorder(a, s, e);
        const at = new Map(order.map((i, v) => [i, v]));
        const sorted = [...order].sort((x, y) => x - y);
        for (let k = 0; k + 1 < sorted.length; k++) {
          const i = sorted[k]!;
          const j = sorted[k + 1]!;
          const level = levels[i - s]!;
          if (levels[j - s] !== level) continue;
          const step = at.get(j)! - at.get(i)!;
          expect(step).toBe(level % 2 === 1 ? -1 : 1);
          t.count(level % 2 === 1 ? 'odd pair' : 'even pair');
        }
      }
    }), runs(RUNS));
    t.atLeast('odd pair', 30);
    t.atLeast('even pair', 80);
  }, timeoutFor(RUNS, 4));

  it('leaves a line with nothing right to left in logical order, and reverses one with nothing left to right', () => {
    const ltr = fc.array(ofClasses(['L', 'EN', 'ES', 'ET', 'CS', 'NSM', 'BN', 'S', 'WS', 'ON']), { maxLength: 40 });
    const rtl = fc.array(ofClasses(['R', 'AL', 'NSM', 'WS', 'ON', 'S', 'CS', 'ES', 'ET', 'BN']), { maxLength: 40 });
    const keptOf = (x: BidiAnalysis) => x.levels.length === 0 ? [] : [...x.removed.keys()].filter((i) => !x.removed[i]);
    fc.assert(fc.property(ltr, rtl, (l, r) => {
      const a = analyze(l, 'ltr');
      expect(reorder(a, 0, l.length).order).toEqual(keptOf(a));
      const b = analyze(r, 'rtl');
      expect(reorder(b, 0, r.length).order).toEqual(keptOf(b).reverse());
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});
