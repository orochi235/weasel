import { describe, expect, it } from 'vitest';
import { RIGID_POSE_COMPOSITION, worldPosesOf } from '@weasel-js/core';
import { diagramScene, type DiagramData, type DiagramSpec } from './fromData';
import { carriedWith, reorderTargetOf, type ReorderScene } from './reorderModel';

/** One row per layer, each patch → pool, every pool into the shared word. */
const layers = (order: readonly string[]): DiagramData => ({
  nodes: [
    ...['a', 'b', 'c'].flatMap((r) => [{ id: `${r}.patch`, lines: [`${r} patch`] }, { id: `${r}.pool`, lines: [`${r} pool`] }]),
    { id: 'word', lines: ['word'] },
  ],
  edges: ['a', 'b', 'c'].flatMap((r) => [{ from: `${r}.patch`, to: `${r}.pool` }, { from: `${r}.pool`, to: 'word' }]),
  groups: [
    ...['a', 'b', 'c'].map((r) => ({ id: r, members: [`${r}.patch`, `${r}.pool`], label: r })),
    { id: 'layers', members: order, reorder: 'y' as const },
  ],
});

const yOf = (specs: readonly DiagramSpec[], id: string) => specs.find((s) => s.id === id)!.pose.y;

const sceneOf = (specs: readonly DiagramSpec[]): ReorderScene => {
  const byId = new Map(specs.map((s) => [s.id as string, { ...s, id: s.id as string }]));
  return {
    get: (id) => byId.get(id),
    renderOrderNodes: () => byId.values(),
    childrenOf: (id) => specs.filter((s) => (s as { parent?: string }).parent === id).map((s) => s.id as string),
  };
};
const rowsOf = (specs: readonly DiagramSpec[], id: string) =>
  specs.filter((s) => (s as { parent?: string }).parent === id).map((s) => s.id as string);
const boxOf = (specs: readonly DiagramSpec[]) => (id: string) => specs.find((s) => s.id === id)?.pose ?? null;

describe('a reorderable group under layered layout', () => {
  it('stacks its members in the order given', () => {
    for (const order of [['a', 'b', 'c'], ['c', 'a', 'b'], ['b', 'c', 'a']]) {
      const specs = diagramScene(layers(order), { layout: 'layered', layoutOptions: { direction: 'right' } });
      const ys = order.map((r) => yOf(specs, `${r}.patch`));
      expect(ys).toEqual([...ys].sort((p, q) => p - q));
    }
  });
});

describe('reorderTargetOf', () => {
  const specs = diagramScene(layers(['a', 'b', 'c']), { layout: 'layered', layoutOptions: { direction: 'right' } });
  const scene = sceneOf(specs);

  it('carries the row a node sits in', () => {
    const target = reorderTargetOf(scene, 'b.pool', boxOf(specs));
    expect(target).toMatchObject({ parent: 'layers', axis: 'y', member: 'b' });
    expect(target!.members).toEqual(['a', 'b', 'c']);
  });

  it('carries a row pressed on its own box', () => {
    expect(reorderTargetOf(scene, 'b', boxOf(specs))?.member).toBe('b');
  });

  it('has nothing to carry outside a reorderable group', () => {
    expect(reorderTargetOf(scene, 'word', boxOf(specs))).toBeNull();
  });

  it('carries a row with its nodes and its title', () => {
    const carried = carriedWith(scene, 'b');
    expect(['b', 'b.patch', 'b.pool', 'b/label'].every((id) => carried.has(id))).toBe(true);
    expect([...carried].filter((id) => !id.startsWith('b'))).toEqual([]);
    // The text rows of each box are its children, and travel with it.
    const rows = rowsOf(specs, 'b.patch');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((id) => carried.has(id))).toBe(true);
  });
});

describe('reorderTargetOf a container marked reorder', () => {
  const node = (id: string, x: number) => ({ id, lines: [id], width: 60, height: 40, at: { x, y: 140 }, pinned: true });
  const data: DiagramData = {
    nodes: [node('m3', 260), node('m1', 60), node('m2', 160), node('out', 600)],
    edges: [],
    containers: [{ id: 'k', role: 'container', label: 'K', members: ['m1', 'm2', 'm3'], reorder: 'x', box: { x: 40, y: 100, width: 320, height: 100 }, pinned: true }],
  };
  const specs = diagramScene(data, { layout: 'none' });
  const world = worldPosesOf(specs, RIGID_POSE_COMPOSITION);
  const scene = sceneOf(specs);
  const worldBox = (id: string) => world.get(id) ?? null;

  it('carries a member along the axis, with every member in the order it stands', () => {
    const target = reorderTargetOf(scene, 'm2', worldBox);
    expect(target).toEqual({ parent: 'k', axis: 'x', member: 'm2', members: ['m1', 'm2', 'm3'] });
  });

  it('has nothing to carry for a node outside it, or in a container not marked reorder', () => {
    expect(reorderTargetOf(scene, 'out', worldBox)).toBeNull();
    const { reorder: _axis, ...unmarked } = data.containers![0]!;
    const plain = diagramScene({ ...data, containers: [unmarked] }, { layout: 'none' });
    expect(reorderTargetOf(sceneOf(plain), 'm2', worldBox)).toBeNull();
  });
});
