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

  it('leaves specs without edges as they are', () => {
    const specs = diagramScene({ nodes: DATA.nodes, edges: [] }, { layout: 'none' });
    expect(createSpecRouter()(specs)).toEqual(specs);
  });
});
