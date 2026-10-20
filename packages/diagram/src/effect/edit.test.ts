import { describe, expect, it } from 'vitest';
import { checkPipeline } from './check';
import {
  addStage, addWire, canWire, ensureWireIds, moveStages, nextStageId, nextWireId,
  reconnectWire, removeStages, removeWires, setLaneOrder, setParam,
} from './edit';
import { nodeGraph } from './nodeGraph';
import { stageFromType, type EffectStageType } from './stageTypes';
import type { EffectDoc, EffectPipeline } from './types';

const src: EffectStageType = { type: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] };
const blur: EffectStageType = {
  type: 'blur', title: 'Blur',
  inputs: [{ id: 'image', type: 'image' }, { id: 'amount', type: 'number' }],
  outputs: [{ id: 'out', type: 'image' }],
  params: [{ id: 'r', label: 'radius', value: '6.0 px', control: { kind: 'number', value: 6, unit: 'px' } }],
};
const empty: EffectDoc = { pipeline: { stages: [], wires: [] }, places: {} };
const ref = (stage: string, port: string) => ({ stage, port });

const built = (): EffectDoc => {
  let d = addStage(empty, stageFromType(src, 'a'), { x: 0, y: 0 });
  d = addStage(d, stageFromType(blur, 'b'), { x: 10, y: 5 });
  d = addStage(d, stageFromType(blur, 'c'), { x: 20, y: 5 });
  d = addWire(d, { from: ref('a', 'out'), to: ref('b', 'image') });
  return addWire(d, { from: ref('b', 'out'), to: ref('c', 'image') });
};

describe('edit', () => {
  it('setLaneOrder stores the lane order, and other edits keep it', () => {
    const d = setLaneOrder(built(), ['number', 'image']);
    expect(d.laneOrder).toEqual(['number', 'image']);
    expect(removeStages(d, ['b']).laneOrder).toEqual(['number', 'image']);
    expect(addWire(d, { from: ref('a', 'out'), to: ref('c', 'image') }).laneOrder).toEqual(['number', 'image']);
  });

  it('removeStages drops wires, places and group memberships without mutating', () => {
    const d = built();
    const g = { ...d, pipeline: { ...d.pipeline, groups: [{ id: 'g', members: ['b', 'c'] }] } };
    const r = removeStages(g, ['b']);
    expect(r.pipeline.wires).toEqual([]);
    expect(r.places.b).toBeUndefined();
    expect(r.pipeline.groups![0]!.members).toEqual(['c']);
    expect(g.pipeline.wires).toHaveLength(2);
    expect(g.places.b).toBeDefined();
  });

  it('removeStages prunes a group left empty, and a group holding only that one', () => {
    const d = built();
    const groups = [{ id: 'inner', members: ['b'] }, { id: 'outer', members: ['inner'] }, { id: 'keep', members: ['b', 'c'] }];
    const r = removeStages({ ...d, pipeline: { ...d.pipeline, groups } }, ['b']);
    expect(r.pipeline.groups).toEqual([{ id: 'keep', members: ['c'] }]);
  });

  it('addWire mints w1 then w2', () => {
    expect(built().pipeline.wires.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('removeWires and reconnectWire', () => {
    const d = built();
    expect(removeWires(d, ['w1']).pipeline.wires.map((w) => w.id)).toEqual(['w2']);
    const r = reconnectWire(d, 'w2', 'to', ref('a', 'x'));
    expect(r.pipeline.wires[1]!.to).toEqual(ref('a', 'x'));
    expect(r.pipeline.wires[1]!.from).toEqual(ref('b', 'out'));
  });

  it('nextStageId and nextWireId skip used ids', () => {
    const d = built();
    expect(nextStageId(d.pipeline, 'blur')).toBe('blur');
    expect(nextStageId(addStage(d, stageFromType(blur, 'blur')).pipeline, 'blur')).toBe('blur-2');
    expect(nextWireId(d.pipeline)).toBe('w3');
  });

  it('canWire', () => {
    const p = built().pipeline;
    expect(canWire(p, ref('a', 'out'), ref('c', 'image'))).toBe(true);
    expect(canWire(p, ref('a', 'out'), ref('c', 'amount'))).toBe(false);
    expect(canWire(p, ref('b', 'image'), ref('c', 'image'))).toBe(false);
    expect(canWire(p, ref('a', 'out'), ref('c', 'nope'))).toBe(false);
    expect(canWire(p, ref('b', 'out'), ref('b', 'image'))).toBe(false);
  });

  it('setParam updates control and value, by id or by label', () => {
    const d = setParam(built(), 'b', 'r', { kind: 'number', value: 6.5, unit: 'px' });
    expect(d.pipeline.stages[1]!.params![0]).toMatchObject({ value: '6.5 px', control: { value: 6.5 } });
    const byLabel = addStage(empty, { id: 'x', title: 'X', params: [{ label: 'gain', value: '1.0' }] });
    const e = setParam(byLabel, 'x', 'gain', { kind: 'number', value: 3 });
    expect(e.pipeline.stages[0]!.params![0]!.value).toBe('3.0');
    expect(setParam(d, 'b', 'radius', { kind: 'number', value: 1 }).pipeline.stages[1]!.params![0]!.value).toBe('6.5 px');
  });

  it('moveStages sets places', () => {
    expect(moveStages(built(), [{ id: 'b', x: 1, y: 2 }]).places.b).toEqual({ x: 1, y: 2 });
  });

  it('ensureWireIds returns the same doc when every wire has an id, else mints unused ones', () => {
    const d = built();
    expect(ensureWireIds(d)).toBe(d);
    const [first, second] = d.pipeline.wires;
    const bare = { ...d, pipeline: { ...d.pipeline, wires: [{ from: first!.from, to: first!.to }, { ...second!, id: 'w1' }] } };
    expect(ensureWireIds(bare).pipeline.wires.map((w) => w.id)).toEqual(['w2', 'w1']);
  });

  it('a doc built through edits has no problems and renders', () => {
    const d = built();
    expect(checkPipeline(d.pipeline)).toEqual([]);
    expect(nodeGraph(d.pipeline).data.nodes).toHaveLength(3);
  });

  it('nodeGraph shows a display-only param, and a control param by its formatted value', () => {
    const p: EffectPipeline = {
      stages: [{ id: 's', title: 'S', params: [
        { label: 'radius', value: '6 px' },
        { label: 'gain', value: 'stale', control: { kind: 'number', value: 2 } },
      ] }],
      wires: [],
    };
    const text = JSON.stringify(nodeGraph(p).data.nodes[0]);
    expect(text).toContain('6 px');
    expect(text).toContain('2.0');
    expect(text).not.toContain('stale');
  });
});
