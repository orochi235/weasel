import { describe, it, expect } from 'vitest';
import { resolveExplicit } from './explicit';
import { buildSequences } from './sequences';
import type { BidiClass } from './types';

const C = (s: string): BidiClass[] => s.split(' ') as BidiClass[];
const seqs = (s: string, p: 0 | 1 = 0) =>
  buildSequences(resolveExplicit(C(s), p));

describe('BD13 — isolating run sequences', () => {
  it('makes one sequence of uniform text', () => {
    const r = seqs('L L L');
    expect(r).toHaveLength(1);
    expect(r[0].indices).toEqual([0, 1, 2]);
  });

  it('splits at a level change', () => {
    // 'L RLE R PDF L' — the embedding codes are removed, leaving levels 0,1,0.
    const r = seqs('L RLE R PDF L');
    expect(r.map((s) => s.indices)).toEqual([[0], [2], [4]]);
  });

  it('omits X9-removed characters entirely', () => {
    for (const s of seqs('L RLE R PDF L')) {
      expect(s.indices).not.toContain(1);
      expect(s.indices).not.toContain(3);
    }
  });

  it('joins a run ending in an isolate initiator to its matching PDI run', () => {
    // The outside text is one sequence across the isolate; the inside is its
    // own. This is the whole point of BD13 — an isolate does not break the
    // sequence around it the way an embedding does.
    const r = seqs('L RLI R PDI L');
    expect(r.map((s) => s.indices)).toEqual([[0, 1, 3, 4], [2]]);
  });

  it('does not join across an unmatched initiator', () => {
    const r = seqs('L RLI R R');
    expect(r.map((s) => s.indices)).toEqual([[0, 1], [2, 3]]);
  });
});

describe('X10 — sos and eos', () => {
  it('takes the paragraph level at both ends of a lone sequence', () => {
    const [s] = seqs('L L');
    expect(s.sos).toBe('L');
    expect(s.eos).toBe('L');
  });

  it('reports R at both ends inside an odd paragraph', () => {
    const [s] = seqs('R R', 1);
    expect(s.sos).toBe('R');
    expect(s.eos).toBe('R');
  });

  it('compares against the neighbouring run, taking the higher level', () => {
    // The level-1 run sits between two level-0 runs, so both its boundaries
    // compare 1 against 0 and take the higher — odd, therefore R.
    const r = seqs('L RLE R PDF L');
    const inner = r.find((s) => s.level === 1)!;
    expect(inner.sos).toBe('R');
    expect(inner.eos).toBe('R');
  });

  it('uses the paragraph level for eos when an isolate is unmatched', () => {
    // The rule is about the sequence *ending with* the unmatched initiator —
    // here the outer one. Without it, eos would compare against the raised
    // text inside the isolate and come back R.
    const r = seqs('L RLI R R');
    const outer = r.find((s) => s.level === 0)!;
    expect(outer.eos).toBe('L');
  });

  it('still ends the isolate contents against the paragraph', () => {
    // The inner sequence does not end in an initiator, so it takes the level
    // after it — nothing follows, so the paragraph level — and the higher of
    // that and its own level is odd.
    const r = seqs('L RLI R R');
    expect(r.find((s) => s.level === 1)!.eos).toBe('R');
  });
});
