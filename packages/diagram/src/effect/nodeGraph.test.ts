import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf } from '../fromData';
import { PROBLEM_COLOR } from './draw';
import { nodeGraph } from './nodeGraph';
import type { EffectPipeline } from './types';

const w = (from: [string, string], to: [string, string], label?: string) =>
  ({ from: { stage: from[0], port: from[1] }, to: { stage: to[0], port: to[1] }, ...(label ? { label } : {}) });

const P: EffectPipeline = {
  types: { bool: { control: true } },
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'q', title: 'high?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image', label: 'yes' }, { id: 'no', type: 'image', label: 'no' }] },
    { id: 'blur', title: 'Blur', bypassed: true, params: [{ label: 'radius', value: '6 px' }],
      inputs: [{ id: 'image', type: 'image' }, { id: 'on', type: 'bool' }], outputs: [{ id: 'out', type: 'image' }] },
    { id: 'flag', title: 'Flag', outputs: [{ id: 'out', type: 'bool' }] },
  ],
  wires: [w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['blur', 'image']), w(['flag', 'out'], ['blur', 'on'])],
  groups: [{ id: 'g', label: 'Soften', members: ['blur'] }],
};

describe('nodeGraph', () => {
  const { data, scene, color } = nodeGraph(P);
  const node = (id: string) => data.nodes.find((n) => n.id === id)!;

  it('makes one node per stage, by stage id, and passes groups through', () => {
    expect(data.nodes.map((n) => n.id)).toEqual(['src', 'q', 'blur', 'flag']);
    expect(data.groups).toEqual([{ id: 'g', label: 'Soften', members: ['blur'] }]);
  });

  it('gives a stage a title row, a ports row with inputs left and outputs right, then its params', () => {
    expect(node('blur').rows).toEqual([
      { kind: 'label', text: 'Blur', style: { bold: true } },
      { kind: 'ports',
        left: [{ id: 'image', label: 'image', type: 'image' }, { id: 'on', label: 'on', type: 'bool' }],
        right: [{ id: 'out', label: 'out', type: 'image' }] },
      { kind: 'field', label: 'radius', value: '6 px' },
    ]);
  });

  it('leaves the params out when asked', () => {
    const rows = nodeGraph(P, { showParams: false }).data.nodes.find((n) => n.id === 'blur')!.rows!;
    expect(rows.some((r) => r.kind === 'field')).toBe(false);
  });

  it('draws a source as a stadium and a decision as its branch symbol', () => {
    expect(node('src').outline).toBe('stadium');
    expect(node('q').outline).toBe('diamond');
    expect(nodeGraph(P, { branch: 'demux' }).data.nodes.find((n) => n.id === 'q')!.outline).toBe('trapezoid');
  });

  it('runs each wire port to port, labels a decision exit, and dashes a control wire', () => {
    expect(data.edges).toEqual([
      { from: 'src', fromPort: 'out', to: 'q', toPort: 'in' },
      { from: 'q', fromPort: 'yes', to: 'blur', toPort: 'image', label: 'yes' },
      { from: 'flag', fromPort: 'out', to: 'blur', toPort: 'on' },
    ]);
    expect(scene.edgeStyle!(data.edges[0]!)!.stroke).toBe(color('image'));
    expect(scene.edgeStyle!(data.edges[0]!)!.dash).toBeUndefined();
    expect(scene.edgeStyle!(data.edges[2]!)!.dash).toEqual([5, 4]);
  });

  it('dashes a bypassed stage\'s outline', () => {
    expect(scene.nodeStyle!(node('blur'))!.dash).toEqual([4, 3]);
    expect(scene.nodeStyle!(node('src'))!.dash).toBeUndefined();
  });

  it('lays out with layered, flowing right', () => {
    expect(scene.layout).toBe('layered');
    expect(scene.layoutOptions?.direction).toBe('right');
  });

  it('draws a mismatched wire in the problem color and leaves out a wire with a missing end', () => {
    const bad = nodeGraph({ ...P, wires: [...P.wires, w(['flag', 'out'], ['blur', 'image']), w(['ghost', 'out'], ['blur', 'image'])] });
    expect(bad.data.edges).toHaveLength(4);
    expect(bad.scene.edgeStyle!(bad.data.edges[3]!)!.stroke).toBe(PROBLEM_COLOR);
  });

  it('keeps the first of two stages sharing an id, so diagramScene does not throw', () => {
    const twice = nodeGraph({ ...P, stages: [...P.stages, { id: 'blur', title: 'Blur again' }] });
    expect(twice.data.nodes.filter((n) => n.id === 'blur')).toHaveLength(1);
    expect(() => diagramScene(twice.data, twice.scene)).not.toThrow();
  });

  it('keeps the first of two groups sharing an id, and drops a group named like a stage', () => {
    const twice = nodeGraph({ ...P, groups: [...P.groups!, { id: 'g', members: ['src'] }, { id: 'src', members: ['flag'] }] });
    expect(twice.data.groups).toEqual([{ id: 'g', label: 'Soften', members: ['blur'] }]);
    expect(() => diagramScene(twice.data, twice.scene)).not.toThrow();
  });

  it('labels a decision exit that has no label with its port id', () => {
    const bare = nodeGraph({
      stages: [
        { id: 'q', title: 'high?', kind: 'decision', outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }] },
        { id: 'a', title: 'A', inputs: [{ id: 'in', type: 'image' }] },
        { id: 'b', title: 'B', inputs: [{ id: 'in', type: 'image' }] },
      ],
      wires: [w(['q', 'yes'], ['a', 'in']), w(['q', 'no'], ['b', 'in'], 'otherwise')],
    });
    expect(bare.data.edges.map((e) => e.label)).toEqual(['yes', 'otherwise']);
  });

  it('gives a stage only its own ports, whatever they are called', () => {
    const compass = nodeGraph({
      stages: [{ id: 'x', title: 'X', inputs: [{ id: 'w', type: 'image' }], outputs: [{ id: 'e', type: 'image' }, { id: 'n', type: 'image' }] }],
      wires: [],
    });
    const spec = diagramScene(compass.data, compass.scene).find((s) => s.kind === 'container' && s.id === 'x')!;
    const ports = (spec.data.diagram as { ports: readonly { id: string }[] }).ports;
    expect(ports.map((p) => p.id).sort()).toEqual(['e', 'n', 'w']);
  });

  it('draws a stage with no ports as a box with its title', () => {
    const bare = nodeGraph({ stages: [{ id: 'x', title: 'X' }], wires: [] });
    expect(bare.data.nodes[0]!.rows).toEqual([{ kind: 'label', text: 'X', style: { bold: true } }]);
  });

  it('answers an empty pipeline with empty data that diagramScene accepts', () => {
    const empty = nodeGraph({ stages: [], wires: [] });
    expect(empty.data).toEqual({ nodes: [], edges: [], groups: [] });
    expect(diagramScene(empty.data, empty.scene)).toEqual([]);
  });

  it('builds a scene whose edge ids are unique', () => {
    const specs = diagramScene(data, scene);
    const ids = data.edges.map(edgeIdOf);
    expect(new Set(ids).size).toBe(ids.length);
    expect(specs.filter((s) => s.kind === 'container').map((s) => s.id)).toEqual(['src', 'q', 'blur', 'flag']);
  });
});

describe('nodeGraph wire ids', () => {
  it('carries a wire id onto its edge', () => {
    const pipeline: EffectPipeline = {
      stages: [
        { id: 'a', title: 'A', outputs: [{ id: 'out', type: 'image' }] },
        { id: 'b', title: 'B', inputs: [{ id: 'in', type: 'image' }] },
      ],
      wires: [{ id: 'w1', ...w(['a', 'out'], ['b', 'in']) }],
    };
    expect(nodeGraph(pipeline).data.edges[0]!.id).toBe('w1');
  });
});
