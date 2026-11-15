/** The ranking keys `docs/snapping.md` ("Ranking") lists after codimension and tier. */
import { describe, it, expect } from 'vitest';
import { resolveSnap, type Flat, type SnapCandidate, type SnapProblem, type Vec } from '../nd';

const plane2: Flat = { at: [0, 0], dirs: [[1, 0], [0, 1]] };
const origin = { id: 'o', at: [0, 0], role: 'origin' as const };
const vline = (x: number): Flat => ({ at: [x, 0], dirs: [[0, 1]] });
const point = (x: number, y: number): Flat => ({ at: [x, y], dirs: [] });

function cand(locus: Flat, order: number, extra: Partial<SnapCandidate<string>> = {}): SnapCandidate<string> {
  return { probe: 'o', locus, source: 'test', order, tier: 'target', reachPx: 8, ...extra };
}

function problem(candidates: SnapCandidate<string>[], p: Partial<SnapProblem<string>> = {}): SnapProblem<string> {
  return { probes: [origin], input: plane2, delta0: [0, 0], candidates, toScreen: (w: Vec) => w, ...p };
}

describe('resolveSnap ranking past codimension', () => {
  it('puts the smaller screen displacement ahead of the lower order', () => {
    const far = cand(point(5, 0), 0);
    const near = cand(point(3, 0), 1);
    expect(resolveSnap(problem([far, near])).members).toEqual([near]);
  });

  it('measures displacement on screen, not in world', () => {
    const toScreen = ([x, y]: Vec): Vec => [x * 10, y];
    const nearInWorld = cand(point(0.7, 0), 0);
    const nearOnScreen = cand(point(0, 6), 1);
    expect(resolveSnap(problem([nearInWorld, nearOnScreen], { toScreen })).members).toEqual([nearOnScreen]);
  });

  it('treats displacements within 1e-9 px as equal, so order decides', () => {
    const later = cand(point(3, 0), 1);
    const earlier = cand(point(3 + 5e-10, 0), 0);
    expect(resolveSnap(problem([later, earlier])).members).toEqual([earlier]);
  });

  it('breaks a full tie by the combination whose lowest order comes first', () => {
    const probes = [origin, { id: 'p', at: [0, 0], role: 'box' as const }];
    const a = cand(point(3, 0), 2);
    const b = cand(point(3, 0), 1, { probe: 'p' });
    expect(resolveSnap(problem([a, b], { probes })).members).toEqual([b]);
  });

  it('counts a candidate out when its solution moves the probe past its reach on screen', () => {
    const line = cand(vline(9), 0);
    expect(resolveSnap(problem([line])).members).toEqual([]);
    expect(resolveSnap(problem([{ ...line, reachPx: 9 }])).members).toHaveLength(1);
  });

  it('keeps the 24 nearest candidates per probe by default', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => cand(vline(1 + i * 0.01), i));
    const far = cand(point(6, 0), 99);
    expect(resolveSnap(problem([...lines(23), far])).codim).toBe(2);
    expect(resolveSnap(problem([...lines(24), far])).codim).toBe(1);
  });
});
