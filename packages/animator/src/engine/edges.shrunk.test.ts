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

describe('animator frames across the double range, shrunk', () => {
  it('a frame gap past the double range counts as the largest double, and nothing throws', () => {
    const h = clocked();
    h.at(-Number.MAX_VALUE);
    const seen: number[] = [];
    let done = 0;
    h.animator.tween({ from: 0, to: 5, ms: 3, easing: 'linear', onTick: (v) => seen.push(v), onDone: () => { done++; } });
    h.animator.spring({ from: 0, to: 5, onTick: (v) => seen.push(v) });
    expect(() => h.at(Number.MAX_VALUE)).not.toThrow();
    expect(done).toBe(1);
    expect(seen.every(Number.isFinite)).toBe(true);
    expect(seen.at(-1)).toBe(5);
    // The clock stopped at the largest double, so one started there reads its own clock as 0, not NaN.
    h.animator.tween({ from: 0, to: 5, ms: 3, onTick: () => {} });
    h.at(Number.MAX_VALUE);
    expect(h.animator.live()[0]!.elapsed).toBe(0);
  });
});
