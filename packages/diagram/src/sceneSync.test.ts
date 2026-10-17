import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf, type DataNode, type DiagramData, type DiagramSpec } from './fromData';
import { diagramLayoutOf, type EdgeRoute, type NodeMove } from './sceneSync';

/** `a -> c` skips a rank, so `layered` gives it waypoints. */
const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }],
  groups: [{ id: 'g', members: ['b', 'c'], label: 'g' }],
};

const poseOf = (specs: readonly DiagramSpec[], id: string) => {
  const p = specs.find((s) => s.id === id)!.pose;
  return { x: p.x, y: p.y };
};

/** What a host keeping `onMove`'s reports does with them. */
function store(data: DiagramData, moves: readonly NodeMove[], routes: readonly EdgeRoute[]): DiagramData {
  const at = new Map(moves.map((m) => [m.id, { x: m.x, y: m.y }]));
  const by = new Map(routes.map((r) => [r.id, r]));
  return {
    ...data,
    nodes: data.nodes.map((n): DataNode => (at.has(n.id) ? { ...n, at: at.get(n.id)!, pinned: true } : n)),
    edges: data.edges.map((e) => {
      const r = by.get(edgeIdOf(e));
      return r === undefined ? e : { ...e, routed: r.waypoints, routedPorts: r.ports };
    }),
  };
}

describe('diagramLayoutOf', () => {
  it("reports where a build's layout put each node, and the routes it wrote", () => {
    const specs = diagramScene(DATA);
    const { moves, routes } = diagramLayoutOf(specs);
    expect(moves.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    for (const m of moves) expect({ x: m.x, y: m.y }).toEqual(poseOf(specs, m.id));

    const long = routes.find((r) => r.id === edgeIdOf({ from: 'a', to: 'c' }))!;
    expect(long.waypoints.length).toBeGreaterThan(0);
    expect(long.ports).toEqual({ from: 's', to: 'n' });
    expect(routes.find((r) => r.id === edgeIdOf({ from: 'a', to: 'b' }))).toEqual({
      id: edgeIdOf({ from: 'a', to: 'b' }), waypoints: [], ports: { from: 's', to: 'n' },
    });
  });

  it('leaves out a pinned node, which stands where the data put it', () => {
    const data = { ...DATA, nodes: DATA.nodes.map((n) => (n.id === 'a' ? { ...n, at: { x: 500, y: 500 }, pinned: true } : n)) };
    expect(diagramLayoutOf(diagramScene(data)).moves.map((m) => m.id).sort()).toEqual(['b', 'c']);
  });

  it('leaves out an author-routed edge, and ports the author named', () => {
    const data: DiagramData = {
      ...DATA,
      edges: [{ from: 'a', to: 'c', waypoints: [{ x: -100, y: 0 }], fromPort: 'e', toPort: 'e' }],
    };
    expect(diagramLayoutOf(diagramScene(data)).routes).toEqual([]);
  });

  it('stored as onMove says, rebuilds to the same places and leaves nothing for layout to place', () => {
    const first = diagramScene(DATA);
    const laid = diagramLayoutOf(first);
    const again = diagramScene(store(DATA, laid.moves, laid.routes));
    for (const id of ['a', 'b', 'c']) expect(poseOf(again, id)).toEqual(poseOf(first, id));
    expect(diagramLayoutOf(again).moves).toEqual([]);
  });

  it('holds stored nodes still across an edit and reports only the node layout placed', () => {
    const first = diagramScene(DATA);
    const kept = store(DATA, diagramLayoutOf(first).moves, []);
    const edited: DiagramData = {
      ...kept,
      nodes: [...kept.nodes, { id: 'd', lines: ['d'] }],
      edges: [...kept.edges, { from: 'c', to: 'd' }],
    };
    const next = diagramScene(edited);
    for (const id of ['a', 'b', 'c']) expect(poseOf(next, id)).toEqual(poseOf(first, id));
    expect(diagramLayoutOf(next).moves).toEqual([{ id: 'd', ...poseOf(next, 'd') }]);
  });
});
