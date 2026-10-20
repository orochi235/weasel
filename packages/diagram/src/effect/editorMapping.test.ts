import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf } from '../fromData';
import { ensureWireIds } from './edit';
import { editorScene } from './editorMapping';
import type { EffectDoc } from './types';

const doc: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
      { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
      {
        id: 'pick', title: 'Pick', kind: 'decision',
        inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }],
      },
    ],
    wires: [
      { id: 'w7', from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } },
      { from: { stage: 'blur', port: 'out' }, to: { stage: 'pick', port: 'in' } },
    ],
    groups: [{ id: 'g', members: ['blur'] }],
  },
  places: { blur: { x: 40, y: 60 } },
};

describe('editorScene', () => {
  it('pins a placed stage at its place and leaves an unplaced one to layout', () => {
    const { data } = editorScene(doc);
    const node = (id: string) => data.nodes.find((n) => n.id === id)!;
    expect(node('blur').pinned).toBe(true);
    expect(node('blur').at).toEqual({ x: 40, y: 60 });
    expect(node('src').pinned).toBeUndefined();
    expect(node('src').at).toBeUndefined();
  });

  it('leaves a pinned stage where it was placed after layout', () => {
    const { data, scene } = editorScene(doc);
    const blur = diagramScene(data, scene).find((s) => s.id === 'blur')!;
    expect([(blur.pose as { x: number }).x, (blur.pose as { y: number }).y]).toEqual([40, 60]);
  });

  it('maps every drawn edge back to its wire, minting ids as ensureWireIds does', () => {
    const { data, wireOf } = editorScene(doc);
    const ids = ensureWireIds(doc).pipeline.wires.map((w) => w.id);
    expect(data.edges.map((e) => wireOf(edgeIdOf(e)))).toEqual(ids);
    expect(wireOf('w7')).toBe('w7');
    expect(wireOf('nope')).toBeUndefined();
  });

  it('draws a wire through its route, found by the id ensureWireIds gives it', () => {
    const ids = ensureWireIds(doc).pipeline.wires.map((w) => w.id!);
    const { data } = editorScene({ ...doc, routes: { [ids[1]!]: [{ x: 300, y: 10 }] } });
    expect(data.edges[0]!.waypoints).toBeUndefined();
    expect(data.edges[1]!.waypoints).toEqual([{ x: 300, y: 10 }]);
  });

  it('maps a stage node to its stage and nothing else', () => {
    const { stageOf } = editorScene(doc);
    expect(stageOf('blur')).toBe('blur');
    expect(stageOf('g')).toBeUndefined();
  });

  it('gives a decision the ports of its stage, by the same ids', () => {
    const { data } = editorScene(doc);
    const pick = data.nodes.find((n) => n.id === 'pick')!;
    expect(pick.ports!.map((p) => p.id).sort()).toEqual(['in', 'no', 'yes']);
  });
});
