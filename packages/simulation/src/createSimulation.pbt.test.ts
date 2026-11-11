/** The integrator from any finite start: finite, deterministic, pinned nodes held, and settling where it says. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSimulation } from './createSimulation';
import { runs, tally, timeoutFor } from './pbt.fixture';
import type { SimulationForce, SimulationNode } from './types';

const anyFinite = fc.oneof(
  { weight: 4, arbitrary: fc.double({ min: -1000, max: 1000, noNaN: true }) },
  { weight: 2, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 1, -1, 1e308, -1e308, Number.MAX_VALUE, 5e-324) },
);
const unit = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, 1, 0.4, 0.0228));

const nodeArb: fc.Arbitrary<SimulationNode> = fc.record({
  x: anyFinite,
  y: anyFinite,
  vx: fc.option(anyFinite, { nil: undefined }),
  vy: fc.option(anyFinite, { nil: undefined }),
  fx: fc.option(anyFinite, { nil: null }),
  fy: fc.option(anyFinite, { nil: null }),
});

const options = fc.record({
  alpha: fc.option(anyFinite, { nil: undefined }),
  alphaTarget: fc.option(anyFinite, { nil: undefined }),
  alphaDecay: fc.option(fc.oneof(unit, anyFinite), { nil: undefined }),
  alphaMin: fc.option(fc.oneof(unit, anyFinite), { nil: undefined }),
  velocityDecay: fc.option(unit, { nil: undefined }),
});

/** A force that pushes every node by the same finite kick, scaled by alpha. */
const kickForce = (nodes: () => SimulationNode[], kx: number, ky: number): SimulationForce => (alpha) => {
  for (const n of nodes()) { n.vx! += kx * alpha; n.vy! += ky * alpha; }
};

const clone = (nodes: SimulationNode[]): SimulationNode[] => nodes.map((n) => ({ ...n }));

describe('createSimulation', () => {
  it('stays finite from any finite start, and holds pinned nodes on their pins', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(nodeArb, { maxLength: 6 }), options, anyFinite, anyFinite, fc.integer({ min: 0, max: 40 }),
      (nodes, opts, kx, ky, ticks) => {
        const list = clone(nodes);
        const sim = createSimulation({ nodes: list, ...opts, forces: [kickForce(() => list, kx, ky)] });
        sim.tick(ticks);
        expect(Number.isFinite(sim.alpha())).toBe(true);
        list.forEach((n, i) => {
          expect(n.index).toBe(i);
          for (const v of [n.x, n.y, n.vx, n.vy]) expect(Number.isFinite(v)).toBe(true);
          if (ticks > 0 && n.fx != null) { expect(n.x).toBe(n.fx); expect(n.vx).toBe(0); seen.count('pinned'); }
        });
        if (ticks > 0 && list.length > 0) seen.count('ticked');
        if (opts.alphaDecay !== undefined && opts.alphaDecay > 2) seen.count('wild decay');
      }), runs(300));
    seen.atLeast('ticked', 100);
    seen.atLeast('pinned', 50);
    seen.atLeast('wild decay', 10);
  }, timeoutFor(300, 3));

  it('moves alpha toward its target without passing it', () => {
    fc.assert(fc.property(options, fc.integer({ min: 1, max: 30 }), (opts, ticks) => {
      const sim = createSimulation({ nodes: [], ...opts });
      const target = sim.alphaTarget();
      let gap = Math.abs(sim.alpha() - target);
      const side = Math.sign(sim.alpha() - target);
      for (let i = 0; i < ticks; i++) {
        sim.tick();
        const now = sim.alpha() - target;
        if (Number.isFinite(gap)) expect(Math.abs(now)).toBeLessThanOrEqual(gap);
        if (now !== 0) expect(Math.sign(now)).toBe(side);
        gap = Math.abs(now);
      }
    }), runs(300));
  }, timeoutFor(300, 1));

  it('ticks the same in one call as in several', () => {
    fc.assert(fc.property(fc.array(nodeArb, { maxLength: 4 }), options, anyFinite, fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }),
      (nodes, opts, k, a, b) => {
        const one = clone(nodes);
        const two = clone(nodes);
        createSimulation({ nodes: one, ...opts, forces: [kickForce(() => one, k, -k)] }).tick(a + b);
        const sim = createSimulation({ nodes: two, ...opts, forces: [kickForce(() => two, k, -k)] });
        sim.tick(a);
        sim.tick(b);
        expect(two).toEqual(one);
      }), runs(200));
  }, timeoutFor(200, 2));
});
