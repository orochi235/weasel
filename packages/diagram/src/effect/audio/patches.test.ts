import type { GraphNodeDef, GraphPatch, GraphTarget } from '@weasel-js/audio';
import { describe, expect, it } from 'vitest';
import { diffPlans } from './patches';
import { EMPTY_PLAN, edgeKey, type LivePlan, type PlanEdge, type PlanNode } from './plan';

type Tagged = GraphNodeDef & { tag: PlanNode };
const build = (id: string, node: PlanNode): GraphNodeDef =>
  ({ inputs: {}, output: { id } as unknown as AudioNode, params: {}, tag: node }) as Tagged;

const node = (type: string, settings: Record<string, unknown> = {}, levels: Record<string, number> = {}): PlanNode => ({
  type,
  settings,
  levels,
});
const out: GraphTarget = { output: true };
const plan = (nodes: Record<string, PlanNode>, edges: PlanEdge[]): LivePlan => ({
  nodes,
  edges: [...edges].sort((a, b) => (edgeKey(a) < edgeKey(b) ? -1 : 1)),
  errors: {},
});

const base = plan(
  {
    osc: node('osc', { wave: 'sine' }, { freq: 440 }),
    gain: node('gain', {}, { level: 0.5 }),
    delay: node('delay', {}, { time: 300 }),
  },
  [
    { from: 'osc', to: { node: 'gain', port: 'in' } },
    { from: 'gain', to: { node: 'delay', port: 'in' } },
    { from: 'delay', to: out },
  ],
);

function replay(start: LivePlan, patches: GraphPatch[]): LivePlan {
  const nodes: Record<string, PlanNode> = { ...start.nodes };
  const edges = new Map(start.edges.map((e) => [edgeKey(e), e]));
  const touches = (e: PlanEdge, id: string) => e.from === id || ('node' in e.to && e.to.node === id);
  for (const p of patches) {
    if (p.kind === 'add' || p.kind === 'replace') nodes[p.id] = { ...(p.def as Tagged).tag };
    else if (p.kind === 'remove') {
      delete nodes[p.id];
      for (const [k, e] of edges) if (touches(e, p.id)) edges.delete(k);
    } else if (p.kind === 'connect') edges.set(edgeKey(p), { from: p.from, to: p.to });
    else if (p.kind === 'disconnect') edges.delete(edgeKey(p));
    else nodes[p.id] = { ...nodes[p.id]!, levels: { ...nodes[p.id]!.levels, [p.param]: p.value } };
  }
  return plan(nodes, [...edges.values()]);
}

describe('diffPlans', () => {
  it('adds every node then connects every edge from nothing', () => {
    const kinds = diffPlans(EMPTY_PLAN, base, build).map((p) => p.kind);
    expect(kinds).toEqual(['add', 'add', 'add', 'connect', 'connect', 'connect']);
  });

  it('sets a changed level with no ramp', () => {
    const next = plan({ ...base.nodes, delay: node('delay', {}, { time: 500 }) }, [...base.edges]);
    expect(diffPlans(base, next, build)).toEqual([{ kind: 'set', id: 'delay', param: 'time', value: 500 }]);
  });

  it('replaces a node whose settings changed, leaving its edges alone', () => {
    const next = plan({ ...base.nodes, osc: node('osc', { wave: 'saw' }, { freq: 440 }) }, [...base.edges]);
    const patches = diffPlans(base, next, build);
    expect(patches.map((p) => [p.kind, 'id' in p ? p.id : ''])).toEqual([['replace', 'osc']]);
  });

  it('replaces a reverb whose seconds changed', () => {
    const a = plan({ rev: node('reverb', { seconds: 1 }) }, []);
    const b = plan({ rev: node('reverb', { seconds: 2 }) }, []);
    expect(diffPlans(a, b, build)).toEqual([{ kind: 'replace', id: 'rev', def: expect.anything() }]);
  });

  it('compares a buffer setting by identity', () => {
    const buf = {};
    const a = plan({ s: node('sample', { buffer: buf }) }, []);
    expect(diffPlans(a, plan({ s: node('sample', { buffer: buf }) }, []), build)).toEqual([]);
    expect(diffPlans(a, plan({ s: node('sample', { buffer: {} }) }, []), build)).toHaveLength(1);
  });

  it('removes a node and reconnects around it without disconnecting its own edges', () => {
    const a = plan({ osc: node('osc'), gain: node('gain') }, [
      { from: 'osc', to: { node: 'gain', port: 'in' } },
      { from: 'gain', to: out },
    ]);
    const b = plan({ osc: node('osc') }, [{ from: 'osc', to: out }]);
    expect(diffPlans(a, b, build)).toEqual([
      { kind: 'remove', id: 'gain' },
      { kind: 'connect', from: 'osc', to: out },
    ]);
  });

  it('removes and re-adds a node of a new type and reconnects every edge touching it', () => {
    const next = plan({ ...base.nodes, gain: node('filter', {}, { level: 0.5 }) }, [...base.edges]);
    const patches = diffPlans(base, next, build);
    expect(patches.map((p) => p.kind)).toEqual(['remove', 'add', 'connect', 'connect']);
    expect(patches.filter((p) => p.kind === 'connect')).toEqual([
      { kind: 'connect', from: 'gain', to: { node: 'delay', port: 'in' } },
      { kind: 'connect', from: 'osc', to: { node: 'gain', port: 'in' } },
    ]);
  });

  it('disconnects an edge between surviving nodes that is gone', () => {
    const next = plan(
      base.nodes,
      base.edges.filter((e) => e.from !== 'delay'),
    );
    expect(diffPlans(base, next, build)).toEqual([{ kind: 'disconnect', from: 'delay', to: out }]);
  });

  it('orders disconnect, remove, add, replace, set, connect', () => {
    const a = plan({ a: node('osc', { w: 1 }, { f: 1 }), b: node('gain'), c: node('gain', {}, { l: 1 }) }, [
      { from: 'a', to: { node: 'b', port: 'in' } },
      { from: 'a', to: { node: 'c', port: 'in' } },
    ]);
    const b = plan({ a: node('osc', { w: 2 }, { f: 1 }), c: node('gain', {}, { l: 2 }), d: node('gain') }, [
      { from: 'a', to: { node: 'd', port: 'in' } },
    ]);
    expect(diffPlans(a, b, build).map((p) => p.kind)).toEqual([
      'disconnect',
      'remove',
      'add',
      'replace',
      'set',
      'connect',
    ]);
  });

  it('round-trips a -> b -> a', () => {
    const b = plan(
      {
        osc: node('osc', { wave: 'saw' }, { freq: 220 }),
        gain: node('filter', {}, { level: 0.5 }),
        rev: node('reverb', { seconds: 2 }),
      },
      [
        { from: 'osc', to: { node: 'gain', port: 'in' } },
        { from: 'gain', to: { node: 'rev', port: 'in' } },
        { from: 'rev', to: out },
      ],
    );
    const there = replay(base, diffPlans(base, b, build));
    expect(there).toEqual(b);
    expect(replay(there, diffPlans(b, base, build))).toEqual(base);
  });

  it('is empty for equal plans', () => {
    expect(diffPlans(base, base, build)).toEqual([]);
  });
});
