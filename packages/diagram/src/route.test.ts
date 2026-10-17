import { describe, expect, it } from 'vitest';
import { bezier } from './edge';
import { diagramScene, edgeIdOf, type DataEdge, type DiagramData, type DiagramSceneOptions } from './fromData';
import type { DiagramEdge } from './edgeTrait';

const traitOf = (data: DiagramData, edge: DataEdge, opts?: DiagramSceneOptions): DiagramEdge => {
  const spec = diagramScene(data, opts).find((s) => s.id === edgeIdOf(edge))!;
  return spec.data!.diagram as DiagramEdge;
};
const poseOf = (data: DiagramData, id: string) =>
  diagramScene(data).find((s) => s.id === id)!.pose;
/** Halfway between an edge's first two waypoints, where its label's room is. */
const roomOf = (data: DiagramData, edge: DataEdge) => {
  const [a, b] = traitOf(data, edge).waypoints!;
  return { near: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 } };
};

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

  it('set a label beside the room layout left it among its waypoints', () => {
    const labeled: DataEdge = { from: 'a', to: 'b', label: 'then' };
    const data: DiagramData = { ...chain, edges: [labeled, chain.edges[1]!] };
    const label = diagramScene(data).find((s) => s.id === `${edgeIdOf(labeled)}/label`)!;
    expect((label.data!.diagram as { label: unknown }).label).toEqual({ at: roomOf(data, labeled), offset: 9 });
    expect(traitOf(data, labeled).waypoints).toHaveLength(2);
  });

  it('leave a label its edge places itself where the edge says', () => {
    const labeled: DataEdge = { from: 'a', to: 'b', label: 'then', labelPlacement: { at: 'start' } };
    const data: DiagramData = { ...chain, edges: [labeled, chain.edges[1]!] };
    const label = diagramScene(data).find((s) => s.id === `${edgeIdOf(labeled)}/label`)!;
    expect((label.data!.diagram as { label: unknown }).label).toEqual({ at: 'start' });
    expect(traitOf(data, labeled).waypoints).toBeUndefined();
  });

  it('station a label the edge puts at the middle the same way, at its own offset', () => {
    const labeled: DataEdge = { from: 'a', to: 'b', label: 'then', labelPlacement: { at: 'mid', offset: 4 } };
    const data: DiagramData = { ...chain, edges: [labeled, chain.edges[1]!] };
    const label = diagramScene(data).find((s) => s.id === `${edgeIdOf(labeled)}/label`)!;
    expect((label.data!.diagram as { label: unknown }).label).toEqual({ at: roomOf(data, labeled), offset: 4 });
  });

  it('come from any layout that plans its routes, not only layered', () => {
    const via = [{ x: 7, y: 8 }];
    const own = Object.assign(() => new Map(), { plan: () => ({ moves: new Map(), waypoints: new Map([[edgeIdOf(skip), via]]) }) });
    expect(traitOf(chain, skip, { layout: own }).waypoints).toEqual(via);
  });

  it('take a long edge around a node in a rank it skips', () => {
    const { waypoints } = traitOf(chain, skip);
    const b = poseOf(chain, 'b');
    expect(waypoints?.length).toBeGreaterThan(0);
    for (const p of waypoints!) expect(p.x <= b.x || p.x >= b.x + b.width).toBe(true);
  });

  it('mark the route layout laid out as its own, and an author\'s as the author\'s', () => {
    const { waypoints, laidOut } = traitOf(chain, skip);
    expect(laidOut).toEqual(waypoints);
    const drawn: DataEdge = { from: 'a', to: 'c', waypoints: [{ x: 5, y: 5 }] };
    expect(traitOf({ ...chain, edges: [chain.edges[0]!, chain.edges[1]!, drawn] }, drawn).laidOut).toBeUndefined();
  });

  it('route an edge between pins around a pin between them', () => {
    const at = { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, c: { x: 0, y: 200 } };
    const pinned: DiagramData = {
      ...chain,
      nodes: chain.nodes.map((n) => ({ ...n, pinned: true, at: at[n.id as keyof typeof at] })),
    };
    const b = poseOf(pinned, 'b') as { x: number; y: number; width: number; height: number };
    const { waypoints } = traitOf(pinned, skip);
    expect(b.width).toBeGreaterThan(0);
    expect(waypoints).toHaveLength(2);
    for (const p of waypoints!) expect(p.x < b.x || p.x > b.x + b.width).toBe(true);
  });

  it('give no waypoints to an edge whose end is a pin layout could not hold', () => {
    // `c` sits too close behind `b` for their ranks to fit, so layout's
    // placeholders say nothing about where `a -> c` should run.
    const at = { a: { x: 0, y: 0 }, b: { x: 300, y: 100 }, c: { x: 0, y: 110 } };
    const crowded: DiagramData = {
      ...chain,
      nodes: chain.nodes.map((n) => ({ ...n, pinned: true, at: at[n.id as keyof typeof at] })),
    };
    expect(traitOf(crowded, skip)).toMatchObject({ from: { port: 's' }, to: { port: 'n' } });
    expect(traitOf(crowded, skip).waypoints).toBeUndefined();
  });

  it('leave an author\'s ports and waypoints alone', () => {
    const authored: DataEdge = { from: 'a', to: 'c', fromPort: 'e', waypoints: [{ x: 500, y: 500 }] };
    const data = { ...chain, edges: [...chain.edges.slice(0, 2), authored] };
    expect(traitOf(data, authored)).toMatchObject({ from: { port: 'e' }, to: { port: 'n' }, waypoints: [{ x: 500, y: 500 }] });
  });

  it('take an edge running back up the ranks around what it skips, leaving toward the last rank', () => {
    const back: DataEdge = { from: 'c', to: 'a' };
    const data = { ...chain, edges: [...chain.edges, back] };
    const { waypoints } = traitOf(data, back);
    const b = diagramScene(data).find((s) => s.id === 'b')!.pose;
    expect(traitOf(data, back)).toMatchObject({ from: { port: 'n' }, to: { port: 's' } });
    expect(waypoints).toHaveLength(2);
    expect(waypoints![0]!.y).toBeGreaterThan(waypoints![1]!.y);
    for (const p of waypoints!) expect(p.x <= b.x || p.x >= b.x + b.width).toBe(true);
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
