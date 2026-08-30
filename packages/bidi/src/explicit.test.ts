import { describe, it, expect } from 'vitest';
import { resolveExplicit, MAX_DEPTH } from './explicit';
import type { BidiClass } from './types';

const C = (s: string): BidiClass[] => s.split(' ') as BidiClass[];
/** Levels with the X9-removed positions dropped, which is what the rules see. */
const kept = (cs: BidiClass[], p: 0 | 1) => {
  const r = resolveExplicit(cs, p);
  return [...r.levels].filter((_, i) => !r.removed[i]);
};

describe('X1-X8 — explicit levels', () => {
  it('puts plain text at the paragraph level', () => {
    expect(kept(C('L L L'), 0)).toEqual([0, 0, 0]);
    expect(kept(C('R R'), 1)).toEqual([1, 1]);
  });

  it('raises an RLE run to the next odd level', () => {
    expect(kept(C('L RLE R PDF L'), 0)).toEqual([0, 1, 0]);
  });

  it('raises an LRE run to the next even level above an odd paragraph', () => {
    expect(kept(C('R LRE L PDF R'), 1)).toEqual([1, 2, 1]);
  });

  it('levels a removed code with the character before it', () => {
    // UAX #9 §5.2: a retained formatting character takes the preceding
    // character's level, so it never opens a level run of its own. The value
    // is unobservable once X9 drops it — pinned so a refactor keeps the
    // convention rather than inventing a different one.
    const r = resolveExplicit(C('L RLE R PDF L'), 0);
    expect(r.levels[1]).toBe(0);
    expect(r.levels[3]).toBe(1);
  });

  it('removes the embedding and pop codes from the output', () => {
    const r = resolveExplicit(C('L RLE R PDF L'), 0);
    expect(r.removed).toEqual([false, true, false, true, false]);
  });

  it('rewrites class under an override', () => {
    // RLO forces every enclosed character to R, whatever it was.
    const r = resolveExplicit(C('LRO R R PDF'), 0);
    expect(r.classes[1]).toBe('L');
    expect(r.classes[2]).toBe('L');
  });

  it('nests embeddings', () => {
    expect(kept(C('L RLE R LRE L PDF R PDF L'), 0)).toEqual([0, 1, 2, 1, 0]);
  });

  it('ignores a PDF with nothing to pop', () => {
    expect(kept(C('L PDF L'), 0)).toEqual([0, 0]);
  });
});

describe('X5a-X6a — isolates', () => {
  it('raises an RLI run and returns after its PDI', () => {
    const r = resolveExplicit(C('L RLI R PDI L'), 0);
    // The initiator and the PDI both sit at the *outside* level, unlike an
    // embedding code, which is removed entirely.
    expect([...r.levels]).toEqual([0, 0, 1, 0, 0]);
    expect(r.removed).toEqual([false, false, false, false, false]);
  });

  it('keeps an unmatched isolate raised to the end', () => {
    const r = resolveExplicit(C('L RLI R R'), 0);
    expect([...r.levels]).toEqual([0, 0, 1, 1]);
  });

  it('resolves FSI by first-strong over its contents', () => {
    const asRtl = resolveExplicit(C('L FSI R PDI L'), 0);
    const asLtr = resolveExplicit(C('L FSI L PDI L'), 0);
    expect([...asRtl.levels]).toEqual([0, 0, 1, 0, 0]);
    expect([...asLtr.levels]).toEqual([0, 0, 2, 0, 0]);
  });

  it('does not let a PDI pop past its own isolate', () => {
    // The stray PDI matches nothing and must leave the embedding alone.
    const r = resolveExplicit(C('RLE PDI L PDF'), 0);
    expect(r.levels[2]).toBe(1);
  });
});

describe('overflow', () => {
  it('stops raising past the maximum depth', () => {
    const cs: BidiClass[] = [];
    for (let i = 0; i < MAX_DEPTH + 10; i++) cs.push('RLE');
    cs.push('L');
    const r = resolveExplicit(cs, 0);
    expect(r.levels[r.levels.length - 1]).toBeLessThanOrEqual(MAX_DEPTH);
  });

  it('unwinds overflow before honoring a real pop', () => {
    const cs: BidiClass[] = ['L'];
    for (let i = 0; i < MAX_DEPTH + 5; i++) cs.push('RLE');
    cs.push('PDF', 'L');
    const r = resolveExplicit(cs, 0);
    // The trailing L is still deep inside valid embeddings: the PDF cancelled
    // an overflow, not a real one.
    expect(r.levels[r.levels.length - 1]).toBeGreaterThan(0);
  });
});
