import { describe, expect, it } from 'vitest';
import { diagramScene, type DiagramSpec } from '../fromData';
import { compact, COMPACT_PADDING } from './compact';
import { PROBLEM_COLOR } from './draw';
import { SAMPLES } from './lab/samples';
import { paintRun } from './run';
import { io, w } from './skipFixture';
import type { EffectPipeline } from './types';

const P: EffectPipeline = {
  types: { number: { control: true } },
  stages: [
    io('src', { kind: 'source', inputs: [] }),
    { id: 'q', title: 'high quality?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }] },
    io('blur', { inputs: [{ id: 'in', type: 'image' }, { id: 'radius', type: 'number' }], params: [{ label: 'radius', value: '6 px' }] }),
    io('mix', { inputs: [{ id: 'base', type: 'image' }, { id: 'over', type: 'image' }] }),
    io('out', { kind: 'sink', outputs: [] }),
    { id: 'osc', title: 'Oscillator', outputs: [{ id: 'value', type: 'number' }] },
  ],
  wires: [
    w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['blur', 'in']), w(['q', 'no'], ['mix', 'base']),
    w(['blur', 'out'], ['mix', 'base']), w(['blur', 'out'], ['mix', 'over']), w(['mix', 'out'], ['out', 'in']),
    w(['osc', 'value'], ['blur', 'radius']),
  ],
  groups: [{ id: 'g', members: ['blur', 'mix'] }],
};

const strokeOpacity = (spec: DiagramSpec) => (spec.data as { stroke?: { paint?: { opacity?: number } } }).stroke?.paint?.opacity;
type Box = { x: number; y: number; width: number; height: number };
const boxes = (p: EffectPipeline, options?: Parameters<typeof compact>[1]) => {
  const drawn = compact(p, options);
  const specs = diagramScene(drawn.data, drawn.scene);
  return { drawn, specs, box: (id: string) => specs.find((s) => s.id === id)!.pose as Box };
};

describe('compact', () => {
  it('draws every stage one row tall, the decision included', () => {
    const one = diagramScene({ nodes: [{ id: 'x', rows: [{ kind: 'label', text: 'X', style: { bold: true } }], padding: COMPACT_PADDING }], edges: [] });
    const row = (one[0]!.pose as Box).height;
    const { box } = boxes(P);
    for (const s of P.stages) expect(box(s.id).height, s.id).toBeCloseTo(row, 6);
    for (const [name, p] of Object.entries(SAMPLES)) {
      const drawn = boxes(p);
      for (const s of p.stages) expect(drawn.box(s.id).height, `${name}: ${s.id}`).toBeCloseTo(row, 6);
    }
  });

  it('shows no params and no value rows', () => {
    const { drawn } = boxes(P);
    const blur = drawn.data.nodes.find((n) => n.id === 'blur')!;
    expect(blur.rows).toHaveLength(1);
  });

  it('gives no port a type, so none is drawn', () => {
    const { drawn } = boxes(P);
    for (const n of drawn.data.nodes) for (const p of n.ports ?? []) expect(p.type, `${n.id}.${p.id}`).toBeUndefined();
  });

  it('draws each edge between ports its nodes have', () => {
    const { drawn } = boxes(P);
    const has = (stage: string, port: string | undefined) => drawn.data.nodes.find((n) => n.id === stage)!.ports!.some((p) => p.id === port);
    for (const e of drawn.data.edges) expect(has(e.from, e.fromPort) && has(e.to, e.toPort), `${e.from} ${e.to}`).toBe(true);
  });

  it('draws two wires between the same two stages as one line, and keeps a decision\'s exits apart', () => {
    const { drawn } = boxes(P);
    expect(drawn.data.edges.filter((e) => e.from === 'blur' && e.to === 'mix')).toHaveLength(1);
    expect(drawn.data.edges.filter((e) => e.from === 'q').map((e) => e.label)).toEqual(['yes', 'no']);
  });

  it('draws a merged line in the problem color when a wire in it was flagged', () => {
    const bad = compact({ ...P, wires: [...P.wires, w(['osc', 'value'], ['mix', 'over'])] });
    const edge = bad.data.edges.find((e) => e.from === 'osc' && e.to === 'mix')!;
    expect(bad.scene.edgeStyle!(edge)!.stroke).toBe(PROBLEM_COLOR);
    expect(bad.data.groups).toEqual(P.groups);
  });

  it('dashes a line only when every wire in it is a control wire', () => {
    const { drawn } = boxes(P);
    const style = (from: string, to: string) => drawn.scene.edgeStyle!(drawn.data.edges.find((e) => e.from === from && e.to === to)!);
    expect(style('osc', 'blur')!.dash).toEqual([5, 4]);
    expect(style('blur', 'mix')!.dash).toBeUndefined();
    const mixed = compact({
      types: P.types,
      stages: [{ id: 'a', title: 'A', outputs: [{ id: 'img', type: 'image' }, { id: 'n', type: 'number' }] },
        { id: 'b', title: 'B', inputs: [{ id: 'img', type: 'image' }, { id: 'n', type: 'number' }] }],
      wires: [w(['a', 'n'], ['b', 'n']), w(['a', 'img'], ['b', 'img'])],
    });
    expect(mixed.data.edges).toHaveLength(1);
    expect(mixed.scene.edgeStyle!(mixed.data.edges[0]!)!.dash).toBeUndefined();
  });

  it('draws a decision as a hexagon by default, and as the symbol `branch` names', () => {
    expect(compact(P).data.nodes.find((n) => n.id === 'q')!.outline).toBe('hexagon');
    expect(compact(P, { branch: 'diamond' }).data.nodes.find((n) => n.id === 'q')!.outline).toBe('diamond');
  });

  it('fades a decision\'s exit a run did not take', () => {
    const { drawn, specs } = boxes(P);
    const run = { stages: { src: {}, q: { taken: 'no' }, blur: {}, mix: {}, out: {}, osc: {} } };
    const painted = paintRun(P, specs, run, drawn.exits);
    const opacity = (id: string) => strokeOpacity(painted.find((s) => s.id === id)!);
    expect(opacity('edge:q.yes->blur.in:yes')).toBeLessThan(1);
    expect(opacity('edge:q.no->mix.base:no')).toBeUndefined();
  });

  it('overlaps no two stages', () => {
    const { box } = boxes(P);
    const ids = P.stages.map((s) => s.id);
    const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) expect(overlap(box(a), box(b)), `${a} ${b}`).toBe(false);
  });
});
