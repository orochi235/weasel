import { describe, expect, it } from 'vitest';
import type { DiagramEdge } from '../edgeTrait';
import { diagramScene, edgeIdOf, type DiagramData, type DiagramSpec } from '../fromData';
import { createSpecHops } from './specHops';

/** `a -> b` runs along y = 20 from x = 100 to 400; `c -> d` runs down x = 250 from y = -100 to 140, after it. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 0 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 400, y: 0 } },
    { id: 'c', lines: [], width: 100, height: 40, at: { x: 200, y: -140 } },
    { id: 'd', lines: [], width: 100, height: 40, at: { x: 200, y: 140 } },
  ],
  edges: [{ from: 'a', to: 'b', router: 'straight' }, { from: 'c', to: 'd', router: 'straight' }],
};
const AB = edgeIdOf(DATA.edges[0]!);
const CD = edgeIdOf(DATA.edges[1]!);

const edgeOf = (specs: readonly DiagramSpec[], id: string) =>
  (specs.find((s) => s.id === id)!.data as { diagram: DiagramEdge }).diagram;

describe('createSpecHops', () => {
  it('gives the later of two crossing edge specs a hop of the size asked for', () => {
    const specs = createSpecHops(6)(diagramScene(DATA, { layout: 'none' }));
    expect(edgeOf(specs, CD).hops).toEqual([{ at: { x: 250, y: 20 }, over: [AB], r: 6 }]);
    expect(edgeOf(specs, AB).hops).toBeUndefined();
  });

  it('finds a crossing at an end inside a container, where that end draws', () => {
    const data: DiagramData = {
      ...DATA,
      containers: [{ id: 'k', role: 'container', label: 'K', members: ['c', 'd'], box: { x: 180, y: -180, width: 140, height: 380 }, pinned: true }],
    };
    const specs = createSpecHops(6)(diagramScene(data, { layout: 'none' }));
    expect(edgeOf(specs, CD).hops).toEqual([{ at: { x: 250, y: 20 }, over: [AB], r: 6 }]);
  });

  it('drops hops a spec carried once its edges no longer cross', () => {
    const hop = createSpecHops(5);
    const crossed = hop(diagramScene(DATA, { layout: 'none' }));
    const apart = crossed.map((s) => (s.id === 'c' || s.id === 'd' ? { ...s, pose: { ...(s.pose as object), x: 700 } } : s)) as DiagramSpec[];
    expect(edgeOf(hop(apart), CD).hops).toBeUndefined();
  });

  it('gives no hop to or over an edge split across pages', () => {
    const specs = diagramScene(DATA, { layout: 'none' }).map((s) => {
      if (s.id !== AB) return s;
      const data = s.data as { diagram: DiagramEdge };
      return { ...s, data: { ...data, diagram: { ...data.diagram, offPage: { ref: 'A', from: 'p1', to: 'p2' } } } } as DiagramSpec;
    });
    const hopped = createSpecHops(6)(specs);
    expect(edgeOf(hopped, CD).hops).toBeUndefined();
    expect(edgeOf(hopped, AB).hops).toBeUndefined();
  });
});
