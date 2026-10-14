import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { rack } from './rack';
import { ADJACENT, SKIP } from './skipFixture';

type Data = ReturnType<typeof rack>['data'];

/** Every edge's ends are nodes, and name ports those nodes have. */
function danglingEnds(data: Data): string[] {
  const portIds = new Map(data.nodes.map((n) => [n.id, new Set([
    ...(n.ports ?? []).map((p) => p.id),
    ...(n.rows ?? []).flatMap((r) => (r.kind === 'ports' ? [...(r.left ?? []), ...(r.right ?? [])].map((p) => p.id) : [])),
  ])]));
  return data.edges.flatMap((e) => [
    ...(portIds.get(e.from)?.has(e.fromPort ?? '') ? [] : [`${e.from}.${e.fromPort}`]),
    ...(portIds.get(e.to)?.has(e.toPort ?? '') ? [] : [`${e.to}.${e.toPort}`]),
  ]);
}

describe('rack ends', () => {
  it('draws every edge between nodes and ports that exist, for a collapsed skip', () => {
    expect(danglingEnds(rack(SKIP).data)).toEqual([]);
  });

  it('keeps two adjacent skip-ahead decisions as symbols with every edge attached', () => {
    const { data } = rack(ADJACENT);
    expect(data.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['q1', 'q2']));
    expect(danglingEnds(data)).toEqual([]);
  });
});

describe('rack', () => {
  const { data, scene } = rack(SKIP);
  const node = (id: string) => data.nodes.find((n) => n.id === id)!;
  const edge = (from: string, to: string) => data.edges.filter((e) => e.from === from && e.to === to);

  it('lays out with the chain layout, flowing right, naming the chain', () => {
    expect(scene.layout).toBe('chain');
    expect(scene.layoutOptions).toMatchObject({ direction: 'right', chain: ['src', 'blur', 'mix', 'out'], chainSide: 'after' });
  });

  it('collapses a skip-ahead decision into an arc over what it skips', () => {
    expect(data.nodes.map((n) => n.id)).toEqual(['src', 'blur', 'mix', 'out', 'osc']);
    expect(edge('src', 'blur')).toHaveLength(1);
    const [arc] = edge('src', 'mix');
    expect(arc).toMatchObject({ fromPort: '~skip-out', toPort: '~skip-in', label: 'high quality?: no' });
    expect(scene.edgeStyle!(arc!).dash).toEqual([5, 4]);
  });

  it('keeps the decision as its symbol when told not to collapse', () => {
    const kept = rack(SKIP, { collapseSkips: false });
    expect(kept.data.nodes.map((n) => n.id)).toContain('q');
    expect(kept.scene.layoutOptions?.chain).toEqual(['src', 'q', 'blur', 'mix', 'out']);
  });

  it('puts the main signal on a stage\'s left and right, and a side input underneath', () => {
    const ports = Object.fromEntries(node('blur').ports!.map((p) => [p.id, p.at]));
    expect(ports.in).toEqual({ u: 0, v: 0.5 });
    expect(ports.out).toEqual({ u: 1, v: 0.5 });
    expect(ports.radius!.v).toBe(1);
  });

  it('labels a wire into a side input with the input\'s name', () => {
    expect(edge('osc', 'blur')[0]).toMatchObject({ fromPort: 'value', toPort: 'radius', label: 'radius' });
  });

  it('turns a side stage\'s output toward the line', () => {
    expect(node('osc').ports!.find((p) => p.id === 'value')!.at.v).toBe(0);
  });

  it('flips everything for side: above', () => {
    const above = rack(SKIP, { side: 'above' });
    expect(above.scene.layoutOptions?.chainSide).toBe('before');
    expect(above.data.nodes.find((n) => n.id === 'blur')!.ports!.find((p) => p.id === 'radius')!.at.v).toBe(0);
    expect(above.data.nodes.find((n) => n.id === 'osc')!.ports!.find((p) => p.id === 'value')!.at.v).toBe(1);
  });

  it('uses the chain it is given', () => {
    expect(rack(SKIP, { chain: ['osc', 'blur'], collapseSkips: false }).scene.layoutOptions?.chain).toEqual(['osc', 'blur']);
  });

  it('drops a collapsed decision from any group that named it', () => {
    const grouped = rack({ ...SKIP, groups: [{ id: 'g', members: ['q', 'blur'] }] });
    expect(grouped.data.groups).toEqual([{ id: 'g', members: ['blur'] }]);
  });

  it('keeps the first of two groups sharing an id, and drops a group named like a stage', () => {
    const twice = rack({ ...SKIP, groups: [{ id: 'g', members: ['q', 'blur'] }, { id: 'g', members: ['mix'] }, { id: 'mix', members: ['osc'] }] });
    expect(twice.data.groups).toEqual([{ id: 'g', members: ['blur'] }]);
    expect(() => diagramScene(twice.data, twice.scene)).not.toThrow();
  });

  it('builds a scene diagramScene accepts, and an empty one for an empty pipeline', () => {
    expect(() => diagramScene(data, scene)).not.toThrow();
    const empty = rack({ stages: [], wires: [] });
    expect(empty.data).toEqual({ nodes: [], edges: [], groups: [] });
    expect(diagramScene(empty.data, empty.scene)).toEqual([]);
  });
});
