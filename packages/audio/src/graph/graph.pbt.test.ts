/**
 * Stateful test of the patchable graph: adds, removes, replaces with other ports, connects, disconnects, param
 * writes, `apply` lists, starts, stops, suspends and resumes, and fade steps, in any interleaving, over ids and
 * port names that include the ones every object answers to. Checked against a model of nodes, edges, and
 * transport after every step; after each settle, the fake Web Audio graph's reachability matches the model's,
 * it holds no cycle, every def that left was disposed once, and each live source is started exactly while the
 * graph plays.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createAudioGraph } from './createAudioGraph';
import type { AudioGraph, GraphNodeDef, GraphPatch, GraphTarget } from './types';
import { writeParam } from '../param';
import { createFakeAudioContext, type FakeAudioContext, type FakeNode } from '../testing/fakeAudioContext';
import { reachesCycle } from '../testing/graphWalk';
import { runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 120;
const FADE = 20;
const IDS = ['a', 'b', 'constructor', '__proto__'] as const;
const PORTS = ['in', 'side', 'constructor', '__proto__', 'toString'] as const;

interface Made {
  def: GraphNodeDef;
  output: FakeNode;
  inputs: Map<string, FakeNode>;
  source: boolean;
  starts: number;
  stops: number;
  disposes: number;
}

/** A def over fake gains whose every input feeds its output, built with own keys for any port name. */
function make(ctx: FakeAudioContext, ports: readonly string[], source: boolean): Made {
  const output = ctx.createGain();
  const inputs = new Map<string, FakeNode>();
  for (const p of ports) {
    const g = ctx.createGain();
    g.connect(output);
    inputs.set(p, g);
  }
  const m: Made = { def: null as never, output, inputs, source, starts: 0, stops: 0, disposes: 0 };
  m.def = {
    inputs: Object.fromEntries(inputs) as never,
    output: output as never,
    params: { level: (v: number, ms: number) => writeParam(ctx as never, output.gain as never, v, ms) },
    dispose: () => {
      m.disposes += 1;
      output.disconnect();
      for (const n of inputs.values()) n.disconnect();
    },
    ...(source ? { start: () => { m.starts += 1; }, stop: () => { m.stops += 1; } } : {}),
  };
  return m;
}

interface MEdge { from: string; to: string | null; port: string }
interface Model { nodes: Map<string, Set<string>>; edges: MEdge[]; playing: boolean }
interface Real {
  ctx: FakeAudioContext;
  graph: AudioGraph;
  timers: Map<number, () => void>;
  live: Map<string, Made>;
  gone: Made[];
}

const seen = tally();
const sameEdge = (a: MEdge, b: MEdge): boolean => a.from === b.from && a.to === b.to && a.port === b.port;
const edgeOf = (from: string, to: GraphTarget): MEdge =>
  ('output' in to ? { from, to: null, port: '' } : { from, to: to.node, port: to.port });

function reachesIn(edges: readonly MEdge[], start: string, goal: string): boolean {
  const stack = [start];
  const seenIds = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === goal) return true;
    if (seenIds.has(n)) continue;
    seenIds.add(n);
    for (const e of edges) if (e.from === n && e.to !== null) stack.push(e.to);
  }
  return false;
}

type Op =
  | { kind: 'add'; id: string; ports: string[]; source: boolean }
  | { kind: 'remove'; id: string }
  | { kind: 'replace'; id: string; ports: string[]; source: boolean }
  | { kind: 'connect'; from: string; to: GraphTarget }
  | { kind: 'disconnect'; from: string; to: GraphTarget }
  | { kind: 'set'; id: string; param: string; value: number };

/** The model's answer to one op: throws the way the graph must, or changes the model. */
function modelOp(m: Model, op: Op): void {
  switch (op.kind) {
    case 'add':
      if (m.nodes.has(op.id)) throw new Error('duplicate');
      m.nodes.set(op.id, new Set(op.ports));
      return;
    case 'remove':
      if (m.nodes.delete(op.id)) m.edges = m.edges.filter((e) => e.from !== op.id && e.to !== op.id);
      return;
    case 'replace': {
      if (!m.nodes.has(op.id)) throw new Error('no node');
      const ports = new Set(op.ports);
      m.nodes.set(op.id, ports);
      m.edges = m.edges.filter((e) => e.to !== op.id || ports.has(e.port));
      return;
    }
    case 'connect': {
      const e = edgeOf(op.from, op.to);
      if (!m.nodes.has(e.from)) throw new Error('no node');
      if (e.to !== null && !m.nodes.get(e.to)?.has(e.port)) throw new Error('no node or port');
      if (m.edges.some((x) => sameEdge(x, e))) return;
      if (e.to !== null && reachesIn(m.edges, e.to, e.from)) throw new Error('cycle');
      m.edges.push(e);
      return;
    }
    case 'disconnect': {
      const e = edgeOf(op.from, op.to);
      m.edges = m.edges.filter((x) => !sameEdge(x, e));
      return;
    }
    case 'set':
      if (!m.nodes.has(op.id) || op.param !== 'level') throw new Error('no node or param');
      if (!Number.isFinite(op.value)) throw new RangeError('not finite');
  }
}

function realOp(r: Real, op: Op): void {
  switch (op.kind) {
    case 'add': {
      const made = make(r.ctx, op.ports, op.source);
      r.graph.add(op.id, made.def);
      r.live.set(op.id, made);
      return;
    }
    case 'remove': {
      const w = r.live.get(op.id);
      r.graph.remove(op.id);
      if (w) { r.live.delete(op.id); r.gone.push(w); }
      return;
    }
    case 'replace': {
      const made = make(r.ctx, op.ports, op.source);
      r.graph.replace(op.id, made.def);
      r.gone.push(r.live.get(op.id)!);
      r.live.set(op.id, made);
      return;
    }
    case 'connect': return r.graph.connect(op.from, op.to);
    case 'disconnect': return r.graph.disconnect(op.from, op.to);
    case 'set': return r.graph.set(op.id, op.param, op.value);
  }
}

/** Run `op` on both sides: both throw or neither does, and a RangeError on one is one on the other. */
function both(m: Model, r: Real, op: Op): void {
  let want: unknown = null;
  try { modelOp(m, op); } catch (e) { want = e; }
  let got: unknown = null;
  try { realOp(r, op); } catch (e) { got = e; }
  seen.count(`${op.kind}:${want ? 'throws' : 'ok'}`);
  if (want === null) expect(got).toBeNull();
  else {
    expect(got).toBeInstanceOf(Error);
    expect((got as Error).message).toMatch(/^@weasel-js\/audio: /);
    expect(got instanceof RangeError).toBe(want instanceof RangeError);
  }
}

const id = fc.constantFrom(...IDS);
const ports: fc.Arbitrary<string[]> = fc.oneof(
  { weight: 3, arbitrary: fc.constant<string[]>(['in']) },
  { weight: 2, arbitrary: fc.uniqueArray(fc.constantFrom<string>(...PORTS), { maxLength: 3 }) },
);
const target: fc.Arbitrary<GraphTarget> = fc.oneof(
  { weight: 1, arbitrary: fc.constant({ output: true as const }) },
  { weight: 4, arbitrary: fc.record({ node: id, port: fc.oneof({ weight: 3, arbitrary: fc.constant('in') }, fc.constantFrom(...PORTS)) }) },
);
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('add' as const), id, ports, source: fc.boolean() }),
  fc.record({ kind: fc.constant('remove' as const), id }),
  fc.record({ kind: fc.constant('replace' as const), id, ports, source: fc.boolean() }),
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('connect' as const), from: id, to: target }) },
  fc.record({ kind: fc.constant('disconnect' as const), from: id, to: target }),
  fc.record({
    kind: fc.constant('set' as const), id, param: fc.constantFrom('level', 'toString', 'gain'),
    value: fc.oneof(fc.double({ min: -2, max: 2, noNaN: true }), fc.constantFrom(NaN, Infinity, -Infinity)),
  }),
);

const step = (r: Real): void => {
  r.ctx._advance(FADE);
  const due = [...r.timers.values()];
  r.timers.clear();
  for (const f of due) f();
};
const settle = (r: Real): void => {
  for (let i = 0; i < 200 && r.timers.size > 0; i += 1) step(r);
  expect(r.timers.size).toBe(0);
};

function reachable(from: FakeNode, to: FakeNode): boolean {
  const stack = [from];
  const s = new Set<FakeNode>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === to) return true;
    if (s.has(n)) continue;
    s.add(n);
    stack.push(...n.connectedTo);
  }
  return false;
}

/** After a settle: the wired graph is the model's, acyclic, with every def that left disposed once. */
function checkSettled(m: Model, r: Real): void {
  for (const [a, made] of r.live) {
    expect(reachesCycle(made.output)).toBe(false);
    const toOut = m.edges.some((e) => e.to === null && (e.from === a || reachesIn(m.edges, a, e.from)));
    expect(reachable(made.output, r.ctx.destination)).toBe(toOut);
    for (const [b, other] of r.live) {
      for (const [port, input] of other.inputs) {
        const want = m.edges.some((e) => e.to === b && e.port === port && (e.from === a || reachesIn(m.edges, a, e.from)));
        expect(reachable(made.output, input)).toBe(want);
      }
    }
    expect(made.disposes).toBe(0);
    if (made.source) expect(made.starts - made.stops).toBe(m.playing ? 1 : 0);
  }
  for (const g of r.gone) {
    expect(g.disposes).toBe(1);
    expect(g.starts - g.stops).toBe(0);
  }
  seen.count('settled');
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, check: (m: Model) => boolean, run: (m: Model, r: Real) => void): Cmd => ({
  check, run(m, r) {
    run(m, r);
    expect([...r.graph.ids()].sort()).toEqual([...m.nodes.keys()].sort());
    for (const i of IDS) expect(r.graph.has(i)).toBe(m.nodes.has(i));
    expect(r.graph.isPlaying()).toBe(m.playing);
  },
  toString: () => name,
});

const single = op.map((o) => cmd(JSON.stringify(o), () => true, (m, r) => both(m, r, o)));
const commands = fc.commands([
  single, single, single, single, single, single,
  fc.array(op, { minLength: 1, maxLength: 5 }).map((list) => cmd(`apply ${JSON.stringify(list)}`, () => true, (m, r) => {
    const copy: Model = { nodes: new Map([...m.nodes].map(([k, v]) => [k, new Set(v)])), edges: [...m.edges], playing: m.playing };
    let structural: unknown = null;
    let setError: unknown = null;
    for (const o of list) {
      try { modelOp(copy, o); } catch (e) {
        if (o.kind !== 'set' || !(e instanceof RangeError)) { structural = e; break; }
        setError ??= e;
      }
    }
    const live = new Map(r.live);
    const gone = r.gone.length;
    const patches: GraphPatch[] = list.map((o) => {
      if (o.kind !== 'add' && o.kind !== 'replace') return o;
      const made = make(r.ctx, o.ports, o.source);
      return { kind: o.kind, id: o.id, def: made.def, made } as GraphPatch & { made: Made };
    });
    let got: unknown = null;
    try { r.graph.apply(patches); } catch (e) { got = e; }
    seen.count(`apply:${structural ? 'refused' : setError ? 'set-failed' : 'ok'}`);
    if (structural) {
      expect(got).toBeInstanceOf(Error);
      expect(r.live).toEqual(live);
      expect(r.gone.length).toBe(gone);
      return;
    }
    if (setError) expect(got).toBeInstanceOf(RangeError);
    else expect(got).toBeNull();
    for (const p of patches as (GraphPatch & { made?: Made })[]) {
      if (p.kind === 'add') r.live.set(p.id, p.made!);
      else if (p.kind === 'replace') { r.gone.push(r.live.get(p.id)!); r.live.set(p.id, p.made!); }
      else if (p.kind === 'remove' && r.live.has(p.id)) { r.gone.push(r.live.get(p.id)!); r.live.delete(p.id); }
    }
    m.nodes = copy.nodes;
    m.edges = copy.edges;
  })),
  fc.constant(cmd('start', () => true, (m, r) => { r.graph.start(); m.playing = true; })),
  fc.constant(cmd('stop', () => true, (m, r) => { r.graph.stop(); m.playing = false; })),
  fc.constant(cmd('step', () => true, (_m, r) => step(r))),
  fc.constant(cmd('settle', () => true, (m, r) => { settle(r); checkSettled(m, r); })),
  fc.constantFrom('running', 'suspended').map((s) => cmd(`state ${s}`, () => true, (_m, r) => r.ctx._setState(s as 'running'))),
], { maxCommands: 60, size: '+1' });

function setup(): { model: Model; real: Real } {
  const ctx = createFakeAudioContext();
  ctx.state = 'running';
  const timers = new Map<number, () => void>();
  let next = 0;
  const graph = createAudioGraph(ctx as never, ctx.destination as never, {
    fadeMs: FADE,
    setTimer: (cb) => { next += 1; timers.set(next, cb); return next; },
    clearTimer: (h) => { timers.delete(h as number); },
  });
  return {
    model: { nodes: new Map(), edges: [], playing: false },
    real: { ctx, graph, timers, live: new Map(), gone: [] },
  };
}

describe('the audio graph against a model', () => {
  it('keeps its nodes, edges, and transport through any sequence of edits, and wires what the model says', () => {
    fc.assert(fc.property(commands, (cmds) => {
      const { model, real } = setup();
      fc.modelRun(() => ({ model, real }), cmds);
      settle(real);
      checkSettled(model, real);
      real.graph.dispose();
      settle(real);
      for (const made of [...real.live.values(), ...real.gone]) {
        expect(made.disposes).toBe(1);
        expect(made.starts - made.stops).toBe(0);
      }
      expect(real.ctx.destination.connectedFrom).toEqual([]);
      expect(() => real.graph.add('z', make(real.ctx, [], false).def)).toThrow(/disposed/);
    }), runs(RUNS));
    for (const k of ['add:ok', 'remove:ok', 'replace:ok', 'connect:ok', 'connect:throws', 'set:ok', 'set:throws',
      'apply:ok', 'apply:refused', 'settled']) seen.atLeast(k, 5);
  }, timeoutFor(RUNS, 40));
});
