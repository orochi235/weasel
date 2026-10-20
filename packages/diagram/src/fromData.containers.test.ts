import { describe, expect, it } from 'vitest';
import type { DiagramData } from './dataTypes';
import { diagramScene, edgeIdOf, type DiagramSpec } from './fromData';
import type { DiagramEdge } from './edgeTrait';

const boxOf = (specs: readonly DiagramSpec[], id: string) => {
  const { x, y, width, height } = specs.find((s) => s.id === id)!.pose;
  return { x, y, width, height };
};
const node = (id: string, at?: { x: number; y: number }) => ({ id, lines: [id], width: 60, height: 40, ...(at ? { at } : {}) });

/** `a` feeds a boxed container's `m1`, and `m2` inside it feeds `b`. */
const DATA: DiagramData = {
  nodes: [node('a'), node('m1', { x: 1020, y: 1040 }), node('m2', { x: 1120, y: 1040 }), node('b')],
  edges: [{ from: 'a', to: 'm1' }, { from: 'm1', to: 'm2' }, { from: 'm2', to: 'b' }],
  containers: [{ id: 'k', role: 'container', label: 'K', members: ['m1', 'm2'], box: { x: 1000, y: 1000, width: 220, height: 100 } }],
};

describe('diagramScene lays a boxed region out as one node', () => {
  it('ranks it between the nodes its members connect to, at its own size', () => {
    const specs = diagramScene(DATA);
    const [a, k, b] = ['a', 'k', 'b'].map((id) => boxOf(specs, id));
    expect(k!.width).toBe(220);
    expect(k!.height).toBe(100);
    expect(a!.y + a!.height).toBeLessThan(k!.y);
    expect(k!.y + k!.height).toBeLessThan(b!.y);
  });

  it('carries its members along, each where it stood in the box', () => {
    const specs = diagramScene(DATA);
    const k = boxOf(specs, 'k');
    expect(boxOf(specs, 'm1')).toMatchObject({ x: k.x + 20, y: k.y + 40 });
    expect(boxOf(specs, 'm2')).toMatchObject({ x: k.x + 120, y: k.y + 40 });
  });

  it('keeps the plan\'s route off an edge it ranked against the region, and gives the inner edge none', () => {
    const specs = diagramScene({ ...DATA, nodes: [...DATA.nodes, node('c')], edges: [...DATA.edges, { from: 'a', to: 'c' }, { from: 'c', to: 'b' }] });
    const edge = (from: string, to: string) => specs.find((s) => s.id === edgeIdOf({ from, to }))!.data.diagram as DiagramEdge;
    expect(edge('a', 'm1').laidOut).toBeUndefined();
    expect(edge('m1', 'm2').laidOut).toBeUndefined();
  });

  it('leaves a pinned box where the data put it', () => {
    const specs = diagramScene({ ...DATA, containers: [{ ...DATA.containers![0]!, pinned: true }] });
    expect(boxOf(specs, 'k')).toEqual({ x: 1000, y: 1000, width: 220, height: 100 });
    expect(boxOf(specs, 'm1')).toMatchObject({ x: 1020, y: 1040 });
  });

  it('keeps a fitted container\'s members together and its box around them', () => {
    const data: DiagramData = {
      nodes: [node('a'), node('b'), node('c'), node('d')],
      edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'd' }],
      containers: [{ id: 'k', role: 'container', label: 'K', members: ['b'] }],
    };
    const specs = diagramScene(data);
    const k = boxOf(specs, 'k');
    const b = boxOf(specs, 'b');
    expect(b.x).toBeGreaterThan(k.x);
    expect(b.y).toBeGreaterThanOrEqual(k.y + 28);
    for (const id of ['a', 'c', 'd']) {
      const o = boxOf(specs, id);
      const apart = o.x + o.width <= k.x || o.x >= k.x + k.width || o.y + o.height <= k.y || o.y >= k.y + k.height;
      expect(apart).toBe(true);
    }
  });
});
