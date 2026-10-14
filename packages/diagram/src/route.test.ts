import { describe, expect, it } from 'vitest';
import { bezier } from './edge';
import { diagramScene, edgeIdOf, type DataEdge, type DiagramData, type DiagramSceneOptions } from './fromData';
import type { DiagramEdge } from './edge';

const traitOf = (data: DiagramData, edge: DataEdge, opts?: DiagramSceneOptions): DiagramEdge => {
  const spec = diagramScene(data, opts).find((s) => s.id === edgeIdOf(edge))!;
  return spec.data!.diagram as DiagramEdge;
};
const poseOf = (data: DiagramData, id: string) =>
  diagramScene(data).find((s) => s.id === id)!.pose;

// `a` feeds `b`, which feeds `c`; `a` also feeds `c` straight, past `b`.
const skip: DataEdge = { from: 'a', to: 'c' };
const chain: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, skip],
};

describe('layered routes', () => {
  it('leave by the face toward the next rank and arrive at the face toward the last', () => {
    expect(traitOf(chain, chain.edges[0]!)).toMatchObject({ from: { port: 's' }, to: { port: 'n' } });
    expect(traitOf(chain, chain.edges[0]!, { layoutOptions: { direction: 'right' } }))
      .toMatchObject({ from: { port: 'e' }, to: { port: 'w' } });
  });

  it('take a long edge around a node in a rank it skips', () => {
    const { waypoints } = traitOf(chain, skip);
    const b = poseOf(chain, 'b');
    expect(waypoints?.length).toBeGreaterThan(0);
    for (const p of waypoints!) expect(p.x <= b.x || p.x >= b.x + b.width).toBe(true);
  });

  it('give no waypoints where nothing is in the way', () => {
    // Pinned so `b`, in the rank `a -> c` skips, stands well off its line.
    const at = { a: { x: 0, y: 0 }, b: { x: 300, y: 100 }, c: { x: 0, y: 200 } };
    const clear: DiagramData = {
      ...chain,
      nodes: chain.nodes.map((n) => ({ ...n, pinned: true, at: at[n.id as keyof typeof at] })),
    };
    expect(traitOf(clear, skip)).toMatchObject({ from: { port: 's' }, to: { port: 'n' } });
    expect(traitOf(clear, skip).waypoints).toBeUndefined();
  });

  it('leave an author\'s ports and waypoints alone', () => {
    const authored: DataEdge = { from: 'a', to: 'c', fromPort: 'e', waypoints: [{ x: 500, y: 500 }] };
    const data = { ...chain, edges: [...chain.edges.slice(0, 2), authored] };
    expect(traitOf(data, authored)).toMatchObject({ from: { port: 'e' }, to: { port: 'n' }, waypoints: [{ x: 500, y: 500 }] });
  });

  it('leave an edge running back up the ranks to the facing rule', () => {
    const back: DataEdge = { from: 'c', to: 'a' };
    const data = { ...chain, edges: [...chain.edges, back] };
    expect(traitOf(data, back)).toMatchObject({ from: {}, to: {} });
    expect(traitOf(data, back).waypoints).toBeUndefined();
  });

  it('are not made for any other layout', () => {
    expect(traitOf(chain, skip, { layout: 'tree' })).toMatchObject({ from: {}, to: {} });
  });
});

describe('bezier through waypoints', () => {
  it('passes a waypoint without a corner', () => {
    const port = (x: number, y: number, ny: number) =>
      ({ id: 'p', nodeId: 'n', point: { x, y }, normal: { x: 0, y: ny } });
    const pts = bezier({ from: port(0, 0, 1), to: port(0, 200, -1), waypoints: [{ x: 50, y: 100 }] });
    const at = pts.findIndex((p) => Math.abs(p.x - 50) < 1e-9 && Math.abs(p.y - 100) < 1e-9);
    const before = pts[at - 1]!;
    const after = pts[at + 1]!;
    const inA = Math.atan2(100 - before.y, 50 - before.x);
    const outA = Math.atan2(after.y - 100, after.x - 50);
    expect(Math.abs(inA - outA)).toBeLessThan(0.2);
  });
});
