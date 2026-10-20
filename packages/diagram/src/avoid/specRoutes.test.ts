import { describe, expect, it } from 'vitest';
import type { DiagramEdge } from '../edgeTrait';
import { diagramScene, edgeIdOf, type DiagramData, type DiagramSpec } from '../fromData';
import { createSpecRouter } from './specRoutes';

const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['a'], at: { x: 0, y: 0 }, width: 100 },
    { id: 'wall', lines: ['wall'], at: { x: 200, y: -40 }, width: 60, height: 120 },
    { id: 'b', lines: ['b'], at: { x: 400, y: 0 }, width: 100 },
    { id: 'c', lines: ['c'], at: { x: 0, y: 400 }, width: 100 },
    { id: 'd', lines: ['d'], at: { x: 400, y: 400 }, width: 100 },
  ],
  edges: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }],
};
const AB = edgeIdOf({ from: 'a', to: 'b' });
const CD = edgeIdOf({ from: 'c', to: 'd' });

const edgeOf = (specs: readonly DiagramSpec[], id: string) =>
  (specs.find((s) => s.id === id)!.data as { diagram: DiagramEdge }).diagram;

describe('createSpecRouter', () => {
  it('routes every edge spec around the shapes', () => {
    const specs = createSpecRouter()(diagramScene(DATA, { layout: 'none' }));
    expect(edgeOf(specs, AB).router).toBe('avoid');
    expect(edgeOf(specs, AB).route!.length).toBeGreaterThan(0);
    expect(edgeOf(specs, CD).route).toEqual([]);
  });

  it('keeps each route across rebuilds, rerouting only what a change disturbed', () => {
    const route = createSpecRouter();
    const first = route(diagramScene(DATA, { layout: 'none' }));
    const moved = { ...DATA, nodes: DATA.nodes.map((n) => (n.id === 'd' ? { ...n, at: { x: 400, y: 450 } } : n)) };
    const second = route(diagramScene(moved, { layout: 'none' }));
    expect(edgeOf(second, AB).route).toBe(edgeOf(first, AB).route);
    expect(edgeOf(second, CD).route).not.toEqual(edgeOf(first, CD).route);
  });

  it('routes around a region neither end is in, and into one an end is in, clear of its header', () => {
    const data: DiagramData = {
      nodes: [
        { id: 'a', lines: ['a'], at: { x: 0, y: 0 }, width: 60 },
        { id: 'b', lines: ['b'], at: { x: 400, y: 0 }, width: 60 },
        { id: 'm', lines: ['m'], at: { x: 220, y: 200 }, width: 60 },
      ],
      edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'm' }],
      containers: [{ id: 'k', role: 'container', label: 'K', members: ['m'], box: { x: 150, y: -60, width: 200, height: 320 }, pinned: true }],
    };
    const specs = createSpecRouter()(diagramScene(data, { layout: 'none' }));
    const k = specs.find((s) => s.id === 'k')!.pose;
    const header = { ...k, height: 28 };
    const crosses = (route: readonly { x: number; y: number }[], box: typeof k) => route.slice(1).some((p, i) => {
      const q = route[i]!;
      for (let t = 0; t <= 1; t += 0.05) {
        const x = q.x + (p.x - q.x) * t;
        const y = q.y + (p.y - q.y) * t;
        if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) return true;
      }
      return false;
    });
    const ab = edgeOf(specs, edgeIdOf({ from: 'a', to: 'b' })).route!;
    const am = edgeOf(specs, edgeIdOf({ from: 'a', to: 'm' })).route!;
    expect(ab.length).toBeGreaterThan(0);
    expect(crosses(ab, k)).toBe(false);
    expect(am.length).toBeGreaterThan(0);
    expect(crosses(am, header)).toBe(false);
  });

  it('leaves specs without edges as they are', () => {
    const specs = diagramScene({ nodes: DATA.nodes, edges: [] }, { layout: 'none' });
    expect(createSpecRouter()(specs)).toEqual(specs);
  });

  it('routes an edge around another edge’s label', () => {
    const data: DiagramData = {
      nodes: [
        { id: 'a', lines: ['a'], at: { x: 0, y: 0 }, width: 100, height: 60 },
        { id: 'b', lines: ['b'], at: { x: 400, y: 0 }, width: 100, height: 60 },
        { id: 'up', lines: ['up'], at: { x: 150, y: -200 }, width: 100, height: 60 },
        { id: 'down', lines: ['down'], at: { x: 150, y: 200 }, width: 100, height: 60 },
      ],
      edges: [{ from: 'a', to: 'b' }, { from: 'up', to: 'down', label: 'a long note' }],
    };
    const bare = createSpecRouter()(diagramScene({ ...data, edges: [data.edges[0]!, { from: 'up', to: 'down' }] }, { layout: 'none' }));
    expect(edgeOf(bare, AB).route).toEqual([]);
    const specs = createSpecRouter()(diagramScene(data, { layout: 'none' }));
    expect(edgeOf(specs, AB).route!.length).toBeGreaterThan(0);
  });
});
