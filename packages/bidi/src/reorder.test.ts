import { describe, it, expect } from 'vitest';
import { resolveLevels } from './resolve';
import { reorderLine } from './reorder';
import type { BidiClass } from './types';

const C = (s: string): BidiClass[] => s.split(' ') as BidiClass[];
const line = (s: string, dir: 'ltr' | 'rtl' | 'auto', start = 0, end?: number) => {
  const cs = C(s);
  return reorderLine(cs, resolveLevels(cs, dir), start, end ?? cs.length);
};

describe('L2 — reordering', () => {
  it('leaves left-to-right text alone', () => {
    expect(line('L L L', 'ltr').order).toEqual([0, 1, 2]);
  });

  it('reverses a right-to-left paragraph', () => {
    expect(line('R R R', 'rtl').order).toEqual([2, 1, 0]);
  });

  it('reverses only the right-to-left stretch inside left-to-right text', () => {
    expect(line('L R R L', 'ltr').order).toEqual([0, 2, 1, 3]);
  });

  it('keeps a number left-to-right inside right-to-left text', () => {
    // The whole point of the algorithm: the digits must not come out reversed.
    // AN sits a level above the R around it, so the inner reversal undoes the
    // outer one for those characters.
    const r = line('R AN R', 'rtl');
    expect([...r.levels]).toEqual([1, 2, 1]);
    expect(r.order).toEqual([2, 1, 0]);
  });

  it('reverses nested levels innermost first', () => {
    expect(line('L R AN L', 'ltr').order).toEqual([0, 2, 1, 3]);
  });

  it('drops the characters X9 removed from the visual order', () => {
    const r = line('L RLE R PDF L', 'ltr');
    expect(r.order).not.toContain(1);
    expect(r.order).not.toContain(3);
  });
});

describe('L1 — resetting to the paragraph level', () => {
  it('resets whitespace at the end of a line', () => {
    // Within the paragraph the space sits between two R runs and N1 raises it
    // to level 1. Ending the *line* after it is what L1 reacts to — which is
    // why this rule cannot run during paragraph analysis.
    const whole = line('R WS R', 'ltr');
    expect([...whole.levels]).toEqual([1, 1, 1]);

    const cut = line('R WS R', 'ltr', 0, 2);
    expect([...cut.levels]).toEqual([1, 0]);
  });

  it('resets a segment separator and the whitespace before it', () => {
    const r = line('R WS S R', 'ltr');
    // S always resets, and the run of whitespace leading into it goes with it.
    expect(r.levels[1]).toBe(0);
    expect(r.levels[2]).toBe(0);
  });

  it('resets a paragraph separator', () => {
    expect(line('R B', 'ltr').levels[1]).toBe(0);
  });

  it('reads the original class, not the resolved one', () => {
    // By L1 the space has been rewritten to R by N1. L1 is specified against
    // the *original* class, so a rule reading the resolved one finds no
    // whitespace to reset and silently does nothing.
    const cut = line('R WS R', 'ltr', 0, 2);
    expect(cut.levels[1]).toBe(0);
  });

  it('leaves whitespace in the middle of a line alone', () => {
    const r = line('R WS R', 'ltr');
    expect(r.levels[1]).toBe(1);
  });
});
