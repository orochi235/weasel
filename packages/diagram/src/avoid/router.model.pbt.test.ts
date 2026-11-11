/**
 * Stateful property test of the avoid router through an editing session: shapes dragged with previews and dropped,
 * connectors added and removed, and the router reseeded, each commit's answers written back the way a scene holds
 * them. After every commit each route a connector holds, answered now or kept from before, still fits its ports and
 * clears every shape, and committing the scene again answers nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createAvoidRouter, type AvoidRouter, type AvoidRoutes } from './router';
import { build, checkRoutes, sceneSpec, stored, type EdgeSpec, type SceneSpec } from './scenes.fixture';
import type { AvoidInput } from './types';

const RUNS = 40;

interface Model { spec: SceneSpec; held: AvoidInput }
interface Real { router: AvoidRouter }

const seen = tally();

/** `frame`'s connectors holding the routes `held` holds for them, by id. */
function carrying(frame: AvoidInput, held: AvoidInput): AvoidInput {
  const routes = new Map(held.edges.map((e) => [e.id, e.route]));
  return { ...frame, edges: frame.edges.map((e) => {
    const route = routes.get(e.id);
    return route === undefined ? e : { ...e, route };
  }) };
}

/** What the connectors of `input` hold, as routes: an answer for each. */
const heldRoutes = (input: AvoidInput): AvoidRoutes => new Map(input.edges.map((e) => [e.id, e.route ?? null]));

function commit(m: Model, r: Real, spec: SceneSpec): void {
  const frame = carrying(build(spec), m.held);
  const answered = r.router.update(frame);
  if (answered.size > 0) seen.count('answered');
  m.spec = spec;
  m.held = stored(frame, answered);
  checkRoutes(m.held, heldRoutes(m.held), seen);
  expect([...r.router.update(m.held).keys()]).toEqual([]);
}

class Drag implements fc.Command<Model, Real> {
  constructor(readonly k: number, readonly jx: number, readonly jy: number, readonly frames: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const k = this.k % m.spec.shapes.length;
    const at = (f: number) => ({
      ...m.spec,
      shapes: m.spec.shapes.map((s, i) => (i === k ? { ...s, jx: Math.round(s.jx + ((this.jx - s.jx) * f) / this.frames), jy: Math.round(s.jy + ((this.jy - s.jy) * f) / this.frames) } : s)),
    });
    const hadRegion = m.held.obstacles.some((o) => o.kind === 'region');
    for (let f = 1; f < this.frames; f++) {
      const frame = carrying(build(at(f), hadRegion), m.held);
      checkRoutes(frame, r.router.update(frame, { preview: true }), seen, false);
      seen.count('preview');
    }
    commit(m, r, at(this.frames));
  }
  toString = () => `drag(${this.k}, ${this.jx}, ${this.jy}, ${this.frames})`;
}

class Connect implements fc.Command<Model, Real> {
  constructor(readonly edge: EdgeSpec) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const n = m.spec.shapes.length;
    const edge = { ...this.edge, a: this.edge.a % n, b: this.edge.b % (n - 1) };
    commit(m, r, { ...m.spec, edges: [...m.spec.edges, edge] });
  }
  toString = () => `connect(${JSON.stringify(this.edge)})`;
}

class Disconnect implements fc.Command<Model, Real> {
  constructor(readonly k: number) {}
  check = (m: Readonly<Model>) => m.spec.edges.length > 0;
  run(m: Model, r: Real): void {
    // Ids are by position, so dropping one renames those after it: the router reroutes them as new connectors.
    commit(m, r, { ...m.spec, edges: m.spec.edges.filter((_, i) => i !== this.k % m.spec.edges.length) });
  }
  toString = () => `disconnect(${this.k})`;
}

class Reseed implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    r.router = createAvoidRouter();
    r.router.seed(m.held);
    commit(m, r, m.spec);
  }
  toString = () => 'reseed';
}

const edgeSpec: fc.Arbitrary<EdgeSpec> = fc.record({
  a: fc.nat(20), b: fc.nat(20),
  from: fc.subarray(['n', 'e', 's', 'w'], { minLength: 1 }).map((s) => s.join('')),
  to: fc.subarray(['n', 'e', 's', 'w'], { minLength: 1 }).map((s) => s.join('')),
  waypoints: fc.constant([]),
  label: fc.boolean(),
});

const drag = fc.tuple(fc.nat(20), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 1, max: 4 }))
  .map(([k, jx, jy, frames]) => new Drag(k, jx, jy, frames));

const commands = fc.commands([
  drag,
  drag,
  edgeSpec.map((e) => new Connect(e)),
  fc.nat(20).map((k) => new Disconnect(k)),
  fc.constant(new Reseed()),
], { maxCommands: 8 });

describe('createAvoidRouter through an editing session', () => {
  it('holds routes that fit and clear every shape after each commit, and answers nothing again', () => {
    fc.assert(fc.property(sceneSpec, commands, (spec, cmds) => {
      const router = createAvoidRouter();
      const input = build(spec);
      const m: Model = { spec, held: stored(input, router.update(input)) };
      fc.modelRun(() => ({ model: m, real: { router } }), cmds);
    }), runs(RUNS));
    seen.atLeast('answered', RUNS);
    seen.atLeast('preview', RUNS);
    seen.atLeast('routed', RUNS * 4);
  }, timeoutFor(RUNS, 500));
});
