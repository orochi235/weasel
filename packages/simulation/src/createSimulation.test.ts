import { describe, expect, it } from 'vitest';
import { createSimulation } from './createSimulation';
import { DEFAULT_ALPHA_MIN, type SimulationForce, type SimulationNode } from './types';

interface TestNode extends SimulationNode {
  id: string;
}

const node = (id: string, x = 0, y = 0): TestNode => ({ id, x, y });

/** A force that does nothing, for the cases that only watch alpha. */
const inert: SimulationForce<TestNode> = () => {};

describe('createSimulation', () => {
  it('moves nothing until ticked', () => {
    const a = node('a');
    const sim = createSimulation<TestNode>({
      nodes: [a],
      forces: [(alpha) => { a.vx! += alpha; }],
    });
    expect(a.x).toBe(0);
    sim.tick();
    expect(a.x).toBeGreaterThan(0);
  });

  it('primes index and velocity before the first force runs', () => {
    let seen: (number | undefined)[] = [];
    const force: SimulationForce<TestNode> = (alpha) => {
      seen = sim.nodes.map((n) => n.index);
      for (const n of sim.nodes) n.vy! += alpha;
    };
    const sim = createSimulation<TestNode>({ nodes: [node('a'), node('b')], forces: [force] });
    sim.tick();
    expect(seen).toEqual([0, 1]);
    expect(sim.nodes.every((n) => Number.isFinite(n.y))).toBe(true);
  });

  it('settles under an alphaTarget below alphaMin, where alpha can never climb back over it', () => {
    const sim = createSimulation<TestNode>({ nodes: [node('a')], forces: [inert], alphaTarget: DEFAULT_ALPHA_MIN / 2 });
    sim.tick(1000);
    expect(sim.alpha()).toBeLessThan(DEFAULT_ALPHA_MIN);
    expect(sim.isSettled()).toBe(true);
    sim.alphaTarget(0.3);
    expect(sim.isSettled()).toBe(false);
  });

  it('runs a whole relaxation synchronously and settles', () => {
    const sim = createSimulation<TestNode>({ nodes: [node('a')], forces: [inert] });
    expect(sim.isSettled()).toBe(false);
    sim.tick(400);
    expect(sim.alpha()).toBeLessThan(DEFAULT_ALPHA_MIN);
    expect(sim.isSettled()).toBe(true);
  });

  it('hands each force the injected random source', () => {
    const sources: (() => number)[] = [];
    const force: SimulationForce<TestNode> = () => {};
    force.initialize = (_nodes, random) => { sources.push(random!); };
    const random = (): number => 0.5;
    createSimulation<TestNode>({ nodes: [node('a')], forces: [force], random });
    expect(sources).toEqual([random]);
  });

  it('holds a pinned node still while its neighbors move', () => {
    const a = node('a');
    const b = node('b');
    a.fx = 10;
    a.fy = 20;
    const push: SimulationForce<TestNode> = (alpha) => {
      for (const n of [a, b]) { n.vx! += alpha; n.vy! += alpha; }
    };
    const sim = createSimulation<TestNode>({ nodes: [a, b], forces: [push] });
    sim.tick(10);
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
    expect(b.x).toBeGreaterThan(0);
  });

  it('decays alpha without passing its target, under a decay past 1 or one that lands on it', () => {
    const wild = createSimulation<TestNode>({ nodes: [node('a')], forces: [inert], alphaDecay: 1e308 });
    wild.tick(2);
    expect(wild.alpha()).toBe(0);
    const exact = createSimulation<TestNode>({ nodes: [node('a')], forces: [inert], alphaDecay: 1, alphaTarget: 5e-324 });
    exact.tick();
    expect(exact.alpha()).toBe(5e-324);
  });
});
