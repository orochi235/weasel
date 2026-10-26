import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, edgeIdOf, type DataNode, type DiagramData, type DiagramSceneData, type DiagramSpec } from './fromData';
import { diagramLayoutOf, useSceneSync, type ContainerEdit, type EdgeRoute, type NodeMove } from './sceneSync';

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

  it('reports a boxed container not pinned as a box, and leaves out its fitted and pinned ones', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }],
      edges: [],
      containers: [
        { id: 'k', role: 'container', members: ['a'], box: { x: 0, y: 0, width: 200, height: 100 } },
        { id: 'f', role: 'container', members: ['b'] },
        { id: 'p', role: 'pool', pinned: true, lanes: [{ id: 'l' }] },
      ],
    };
    const specs = diagramScene(data);
    const { containers, moves } = diagramLayoutOf(specs);
    const k = specs.find((s) => s.id === 'k')!.pose;
    expect(containers).toEqual([{ kind: 'box', id: 'k', box: { x: k.x, y: k.y, width: 200, height: 100 } }]);
    expect(moves.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });
});

/** A container `k` holding `a`, and `b` on its own. */
const REGIONS: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'], at: { x: 20, y: 40 } }, { id: 'b', lines: ['b'], at: { x: 400, y: 0 } }],
  edges: [],
  containers: [{ id: 'k', role: 'container', members: ['a'], box: { x: 0, y: 0, width: 200, height: 120 } }],
};

function synced(data: DiagramData) {
  const specs = diagramScene(data, { layout: 'none' });
  const scene = createScene<DiagramSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs, registry: withDiagramRegistry() });
  const onMove = vi.fn<(moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => void>();
  const onEditContainer = vi.fn<(edit: ContainerEdit) => void>();
  const hook = renderHook(({ s }) => useSceneSync(scene, s, { onMove, onEditContainer }), { initialProps: { s: specs } });
  return { scene, onMove, onEditContainer, rerender: (next: DiagramData) => hook.rerender({ s: diagramScene(next, { layout: 'none' }) }) };
}

describe('useSceneSync with regions', () => {
  it('reports a node dropped into a region with its new parent, and one dropped out with null', () => {
    const { scene, onMove } = synced(REGIONS);
    act(() => {
      scene.batch('Drop', () => {
        scene.move('b' as NodeId, 'k' as NodeId);
        scene.setPose('b' as NodeId, { ...scene.get('b' as NodeId)!.pose, x: 100, y: 50 });
      });
    });
    expect(onMove).toHaveBeenLastCalledWith([{ id: 'b', x: 100, y: 50, parent: 'k' }], []);
    act(() => scene.move('a' as NodeId, null));
    expect(onMove).toHaveBeenLastCalledWith([{ id: 'a', x: 20, y: 40, parent: null }], []);
  });

  it('reports a region moved as its box, beside the moves of what it carried', () => {
    const { scene, onMove, onEditContainer } = synced(REGIONS);
    act(() => {
      // The container carries `a` in its frame.
      scene.setPose('k' as NodeId, { x: 10, y: 0, width: 200, height: 120 });
    });
    expect(onEditContainer).toHaveBeenCalledWith({ kind: 'box', id: 'k', box: { x: 10, y: 0, width: 200, height: 120 } });
    expect(onMove).toHaveBeenLastCalledWith([{ id: 'a', x: 30, y: 40 }], []);
  });

  it('reports nothing for a change that arrives as new specs', () => {
    const { onMove, onEditContainer, rerender } = synced(REGIONS);
    act(() => rerender({
      ...REGIONS,
      nodes: [REGIONS.nodes[0]!, { ...REGIONS.nodes[1]!, at: { x: 50, y: 50 } }],
      containers: [{ ...REGIONS.containers![0]!, members: ['a', 'b'], box: { x: 0, y: 0, width: 300, height: 120 } }],
    }));
    expect(onMove).not.toHaveBeenCalled();
    expect(onEditContainer).not.toHaveBeenCalled();
  });
});
