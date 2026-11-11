/** Counterexamples `edges.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createTarget } from '../target';
import { clocked } from '../pbt.fixture';

describe('animator edges, shrunk', () => {
  it('a sub-ms tween shows its elapsed share of the way, not a 1 ms tween\'s', () => {
    const h = clocked();
    h.at(0);
    const seen: number[] = [];
    h.animator.tween({ from: 0, to: 1, ms: 1e-323, easing: 'linear', onTick: (v) => seen.push(v) });
    h.at(5e-324);
    expect(seen).toEqual([0.5]);
  });

  it('a sub-ms tween on a target shows its elapsed share of the way', () => {
    const h = clocked();
    h.at(0);
    let committed = 0;
    const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
    h.animator.tween({ target, to: 1, ms: 0.5, easing: 'linear' });
    h.at(0.25);
    expect(target.read()).toBeCloseTo(0.5, 9);
  });
});
