import { describe, expect, it } from 'vitest';
import type { DebugSink } from '@weasel-js/routing';
import { recordSnapCandidates } from './debugCandidates';

describe('recordSnapCandidates', () => {
  it('draws a segment\'s candidate on the segment, not past its end', () => {
    const seen: { x: number; y: number }[] = [];
    const sink = { clearSnap: () => {}, recordSnapCandidate: (p: { x: number; y: number }) => { seen.push(p); } } as unknown as DebugSink;
    const segment = { probe: 'pointer', locus: { at: [0, 0], dirs: [[10, 0]] }, span: [[0, 1]] as [number, number][], source: 's', order: 0, tier: 'target' as const, reachPx: 8 };
    recordSnapCandidates(sink, [segment], [], [{ id: 'pointer', at: { x: 15, y: 3 }, role: 'pointer' }], { x: 0, y: 0 }, null);
    expect(seen).toEqual([{ x: 10, y: 0 }]);
  });
});
