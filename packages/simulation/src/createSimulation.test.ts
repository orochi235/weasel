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

  it('refuses a rate, threshold or tick count that is not a finite number', () => {
    expect(() => createSimulation<TestNode>({ nodes: [], alphaDecay: Number.NaN })).toThrow(RangeError);
    const sim = createSimulation<TestNode>({ nodes: [node('a')], forces: [inert] });
    expect(() => sim.alpha(Number.NaN)).toThrow(/alpha is a finite number, not NaN/);
    expect(() => sim.velocityDecay(Infinity)).toThrow(RangeError);
    expect(() => sim.tick(Infinity)).toThrow(RangeError);
    expect(sim.alpha()).toBe(1);
  });

  it('holds a node pinned to a non-finite fx or fy where it stands', () => {
    const a: TestNode = { id: 'a', x: 3, y: 4, vx: 1, vy: 1, fx: Number.NaN, fy: Infinity };
    const sim = createSimulation({ nodes: [a] });
    sim.tick();
    expect(a).toMatchObject({ x: 3, y: 4, vx: 0, vy: 0 });
  });
});

describe('createSimulation in three dimensions', () => {
  it('moves z only when asked for three dimensions, and primes it to 0', () => {
    const flat: TestNode = { id: 'a', x: 0, y: 0, vz: 5 };
    createSimulation<TestNode>({ nodes: [flat] }).tick();
    expect(flat.z).toBeUndefined();

    const solid: TestNode = { id: 'b', x: 0, y: 0 };
    const sim = createSimulation<TestNode>({ nodes: [solid], dimensions: 3, forces: [(alpha) => { solid.vz! += alpha; }] });
    expect(sim.dimensions).toBe(3);
    expect(solid.z).toBe(0);
    sim.tick();
    expect(solid.z).toBeGreaterThan(0);
    expect(solid.x).toBe(0);
  });

  it('holds a node pinned on z there', () => {
    const a: TestNode = { id: 'a', x: 0, y: 0, z: 3, fz: 7 };
    createSimulation<TestNode>({ nodes: [a], dimensions: 3, forces: [() => { a.vz! += 1; a.vx! += 1; }] }).tick();
    expect(a.z).toBe(7);
    expect(a.vz).toBe(0);
    expect(a.x).toBeGreaterThan(0);
  });

  it('hands its dimensions to each force, as d3-force-3d does', () => {
    let seen: number | undefined;
    const force: SimulationForce<TestNode> = Object.assign(() => {}, {
      initialize: (_nodes: TestNode[], _random?: () => number, dimensions?: number) => { seen = dimensions; },
    });
    createSimulation<TestNode>({ nodes: [node('a')], forces: [force], dimensions: 3 });
    expect(seen).toBe(3);
  });

  it('refuses dimensions other than 1, 2 or 3', () => {
    expect(() => createSimulation<TestNode>({ nodes: [], dimensions: 4 as never })).toThrow(RangeError);
  });
});
