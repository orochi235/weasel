import { describe, expect, it } from 'vitest';
import type { DiagramSpec } from '../fromData';
import { PROBLEM_COLOR } from './draw';
import { SAMPLES } from './lab/samples';
import { sequenceSlots } from '../reorder';
import { LANE_INSET, laneId, laneTypeOf, lanes } from './lanes';
import { paintRun } from './run';
import { built, P, type Box } from './lanesFixture';
import { io, w } from './skipFixture';
import type { EffectPipeline } from './types';

const strokeOpacity = (spec: DiagramSpec) => (spec.data as { stroke?: { paint?: { opacity?: number } } }).stroke?.paint?.opacity;
const stageIds = (p: EffectPipeline) => p.stages.map((s) => s.id);
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('lanes', () => {
  it('draws one lane per value type, top to bottom in the order types first appear', () => {
    const { drawn } = built(P);
    expect(drawn.data.nodes.slice(0, 3).map((n) => n.id)).toEqual([laneId('image'), laneId('number'), laneId('mask')]);
  });

  it('takes the lane order it is given, the rest after', () => {
    const { drawn } = built(P, { lanes: ['mask', 'nothing'] });
    expect(drawn.data.nodes.slice(0, 3).map((n) => n.id)).toEqual([laneId('mask'), laneId('image'), laneId('number')]);
  });

  it('stacks the lanes edge to edge, each as wide as the chart', () => {
    const { box } = built(P);
    const [a, b, c] = ['image', 'number', 'mask'].map((t) => box(laneId(t)));
    expect(b!.y).toBeCloseTo(a!.y + a!.height, 6);
    expect(c!.y).toBeCloseTo(b!.y + b!.height, 6);
    expect(b!.width).toBe(a!.width);
  });

  it('makes each stage as tall as the span of lanes it touches, and sits it inside them', () => {
    const { box } = built(P);
    const lane = (t: string) => box(laneId(t));
    const spans: Record<string, [string, string]> = {
      src: ['image', 'image'], blur: ['image', 'number'], mix: ['image', 'mask'], osc: ['number', 'number'], cut: ['mask', 'mask'],
    };
    for (const [id, [first, last]] of Object.entries(spans)) {
      const b = box(id);
      const top = lane(first).y;
      const bottom = lane(last).y + lane(last).height;
      expect(b.y, id).toBeGreaterThan(top);
      expect(b.y + b.height, id).toBeLessThan(bottom);
      // More beside an edge wires run along: the top, here, which `q.no` takes past `blur`.
      expect(b.y - top, id).toBeGreaterThanOrEqual(LANE_INSET - 1e-6);
      // `blur` stands in group `g`, whose box keeps the inset in its place.
      const outer = id === 'blur' ? box('g') : b;
      expect(bottom - (outer.y + outer.height), id).toBeCloseTo(LANE_INSET, 6);
    }
    const q = box('q');
    expect(q.y).toBeGreaterThan(lane('image').y);
    expect(q.y + q.height).toBeLessThan(lane('image').y + lane('image').height);
  });

  it('overlaps no two stages, two sources of one type included', () => {
    const two: EffectPipeline = { ...P, stages: [...P.stages, io('beams', { inputs: [] })], wires: [...P.wires, w(['beams', 'out'], ['mix', 'over'])] };
    for (const options of [{}, { showValues: true }, { laneHeight: 10 }]) {
      const { box } = built(two, options);
      const ids = stageIds(two);
      for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) expect(overlap(box(a), box(b)), `${a} ${b}`).toBe(false);
    }
  });

  it('widens a source stretched to its lane\'s height, so its rounded ends do not eat its rows', () => {
    for (let n = 0; n <= 10; n++) {
      const tall: EffectPipeline = {
        stages: [
          { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
          { id: 'big', title: 'Big', inputs: [{ id: 'in', type: 'image' }], params: Array.from({ length: n }, (_, i) => ({ label: `p${i}`, value: '1' })) },
        ],
        wires: [w(['src', 'out'], ['big', 'in'])],
      };
      const { specs } = built(tall);
      const title = specs.find((s) => s.parent === 'src' && (s.data as { text?: string }).text === 'Source')!;
      // What the fallback measure makes of the title, in its face.
      const needs = 'Source'.length * title.data.style!.fontSize * 0.6;
      expect((title.pose as Box).width, `${n} params`).toBeGreaterThanOrEqual(needs - 1e-9);
    }
  });

  it('grows a lane until what stands in it fits', () => {
    const { box } = built(P, { laneHeight: 10, showValues: true });
    const lane = box(laneId('image'));
    for (const id of ['src', 'blur', 'mix']) expect(box(id).y).toBeGreaterThan(lane.y);
  });

  it('puts each stage right of every stage that feeds it', () => {
    const { box } = built(P);
    for (const wire of P.wires) {
      expect(box(wire.to.stage).x, `${wire.from.stage} > ${wire.to.stage}`).toBeGreaterThan(box(wire.from.stage).x);
    }
  });

  it('sets each port of an ordinary stage in the lane of its type', () => {
    const { drawn, box } = built(P);
    const lane = (t: string) => box(laneId(t));
    for (const id of ['blur', 'mix']) {
      const node = drawn.data.nodes.find((n) => n.id === id)!;
      const b = box(id);
      for (const port of node.ports!) {
        const y = b.y + port.at.v * b.height;
        const l = lane(port.type!);
        expect(y, `${id}.${port.id}`).toBeGreaterThan(l.y);
        expect(y, `${id}.${port.id}`).toBeLessThan(l.y + l.height);
        expect(port.at.u).toBe(P.stages.find((s) => s.id === id)!.inputs!.some((p) => p.id === port.id) ? 0 : 1);
      }
    }
  });

  it('brings a decision\'s control inputs in from the bottom when their lane is below its signal', () => {
    const steered: EffectPipeline = {
      types: { bool: { control: true } },
      stages: [{ id: 'q', title: 'q', kind: 'decision', inputs: [{ id: 'in', type: 'image' }, { id: 'when', type: 'bool' }],
        outputs: [{ id: 'a', type: 'image' }, { id: 'b', type: 'image' }] }],
      wires: [],
    };
    const at = (order: string[]) => lanes(steered, { lanes: order }).data.nodes.find((n) => n.id === 'q')!.ports!.find((p) => p.id === 'when')!.at.v;
    expect(at(['image', 'bool'])).toBeGreaterThan(0.5);
    expect(at(['bool', 'image'])).toBe(0);
  });

  it('draws a mismatched wire in the problem color and keeps groups', () => {
    const bad = lanes({ ...P, wires: [...P.wires, w(['cut', 'out'], ['blur', 'in'])] });
    expect(bad.scene.edgeStyle!(bad.data.edges[bad.data.edges.length - 1]!).stroke).toBe(PROBLEM_COLOR);
    expect(bad.data.groups).toEqual(P.groups);
  });

  it('fades a decision\'s exit a run did not take', () => {
    const { drawn, specs } = built(P);
    const run = { stages: { src: {}, q: { taken: 'yes' }, blur: {}, mix: {}, out: {}, osc: {}, cut: {} } };
    const painted = paintRun(P, specs, run, drawn.exits);
    const opacity = (from: string, to: string) => strokeOpacity(painted.find((s) => s.id === `edge:q.${from}->${to}:${from}`)!);
    expect(opacity('yes', 'blur.in')).toBeUndefined();
    expect(opacity('no', 'mix.base')).toBeLessThan(1);
  });

  it('draws a pipeline with no stages, and stages with no ports', () => {
    expect(() => built({ stages: [], wires: [] })).not.toThrow();
    const bare = built({ stages: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], wires: [] });
    expect(overlap(bare.box('a'), bare.box('b'))).toBe(false);
  });

  it('places a stage on a loop without throwing', () => {
    const loop: EffectPipeline = { stages: [io('a'), io('b')], wires: [w(['a', 'out'], ['b', 'in']), w(['b', 'out'], ['a', 'in'])] };
    const { box } = built(loop);
    expect(overlap(box('a'), box('b'))).toBe(false);
  });

  it('overlaps no two stages and keeps each inside its lanes, in every lab sample', () => {
    for (const [name, p] of Object.entries(SAMPLES)) {
      const { drawn, box } = built(p);
      const ids = [...new Set(p.stages.map((s) => s.id))];
      for (const [i, a] of ids.entries()) for (const b of ids.slice(i + 1)) expect(overlap(box(a), box(b)), `${name}: ${a} ${b}`).toBe(false);
      const bands = drawn.data.nodes.filter((n) => n.id.startsWith('~lane:')).map((n) => box(n.id));
      const top = Math.min(...bands.map((b) => b.y));
      const bottom = Math.max(...bands.map((b) => b.y + b.height));
      for (const id of ids) {
        expect(box(id).y, `${name}: ${id}`).toBeGreaterThanOrEqual(top);
        expect(box(id).y + box(id).height, `${name}: ${id}`).toBeLessThanOrEqual(bottom);
      }
    }
  });
});

describe('lanes order', () => {
  it('names the main line’s stages left to right, each gap between its neighbors’ boxes', () => {
    const { drawn, box } = built(P);
    expect(drawn.order!.axis).toBe('x');
    const ids = drawn.order!.items.map((i) => i.id);
    expect(ids).toEqual(['src', 'q', 'blur', 'mix', 'out']);
    const { gaps } = sequenceSlots('x', ids.map((id) => ({ id, bounds: box(id) })));
    for (let k = 1; k < ids.length; k++) {
      expect(gaps[k]!.a.x).toBeGreaterThan(box(ids[k - 1]!).x + box(ids[k - 1]!).width);
      expect(gaps[k]!.a.x).toBeLessThan(box(ids[k]!).x);
    }
  });

  it('names the lanes top down, each gripped by its header beside the stages', () => {
    const { drawn, box } = built(P);
    const order = drawn.laneOrder!;
    expect(order.axis).toBe('y');
    expect(order.items.map((i) => i.id)).toEqual([laneId('image'), laneId('number'), laneId('mask')]);
    const firstStage = Math.min(...stageIds(P).map((id) => box(id).x));
    for (const item of order.items) {
      const lane = box(item.id);
      expect(item.grip).toEqual({ x: lane.x, y: lane.y, width: expect.any(Number), height: lane.height });
      expect(item.grip!.width).toBeGreaterThan(0);
      expect(item.grip!.x + item.grip!.width).toBeLessThanOrEqual(firstStage);
    }
    expect(laneTypeOf(order.items[1]!.id)).toBe('number');
  });
});
