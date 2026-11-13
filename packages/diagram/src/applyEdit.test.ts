import { describe, expect, it } from 'vitest';
import { applyDiagramEdit, applyNodeResizes } from './applyEdit';
import type { DiagramData } from './dataTypes';
import { edgeIdOf } from './edgeId';

const DATA: DiagramData = {
  nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  edges: [{ from: 'a', to: 'b' }],
  containers: [
    { id: 'box', role: 'container', members: ['a', 'inner'] },
    { id: 'inner', role: 'container', members: ['b'] },
    { id: 'pool', role: 'pool', lanes: [{ id: 'l1', label: 'One', members: ['c'] }, { id: 'l2' }] },
  ],
};
const none = { moves: [], routes: [], containers: [] };

describe('applyDiagramEdit', () => {
  it('stores a move as the node\'s pinned place, and its parent as membership', () => {
    const out = applyDiagramEdit(DATA, { ...none, moves: [{ id: 'a', x: 5, y: 6, parent: 'l2' }, { id: 'c', x: 1, y: 2, parent: null }] });
    expect(out.nodes[0]).toEqual({ id: 'a', at: { x: 5, y: 6 }, pinned: true });
    expect(out.containers![0]!.members).toEqual(['inner']);
    expect(out.containers![2]!.lanes).toEqual([{ id: 'l1', label: 'One', members: [] }, { id: 'l2', members: ['a'] }]);
  });

  it('leaves what moved unpinned under pin: false', () => {
    const out = applyDiagramEdit(DATA, { ...none, moves: [{ id: 'a', x: 5, y: 6 }] }, { pin: false });
    expect(out.nodes[0]).toEqual({ id: 'a', at: { x: 5, y: 6 } });
  });

  it('stores a route as layout\'s, by the edge\'s id', () => {
    const id = edgeIdOf(DATA.edges[0]!);
    const out = applyDiagramEdit(DATA, { ...none, routes: [{ id, waypoints: [{ x: 1, y: 1 }], ports: { from: 'e' } }] });
    expect(out.edges[0]).toEqual({ from: 'a', to: 'b', routed: [{ x: 1, y: 1 }], routedPorts: { from: 'e' } });
  });

  it('pins a region\'s box, and moves it to the region a drop names', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const out = applyDiagramEdit(DATA, { ...none, containers: [{ kind: 'box', id: 'inner', box, parent: null }] });
    expect(out.containers![1]).toMatchObject({ id: 'inner', box, pinned: true });
    expect(out.containers![0]!.members).toEqual(['a']);
  });

  it('orders and sizes a pool\'s lanes, keeping what each had and adding a new one', () => {
    const out = applyDiagramEdit(DATA, { ...none, containers: [{ kind: 'lanes', pool: 'pool', lanes: [{ id: 'l2', size: 50 }, { id: 'l1', size: 70 }, { id: 'l3', size: 120 }] }] });
    expect(out.containers![2]!.lanes).toEqual([
      { id: 'l2', size: 50 }, { id: 'l1', label: 'One', members: ['c'], size: 70 }, { id: 'l3', size: 120 },
    ]);
  });

  it('releases a container\'s members into its place in the region that held it', () => {
    const out = applyDiagramEdit(DATA, { ...none, containers: [{ kind: 'release', id: 'inner' }] });
    expect(out.containers!.map((c) => c.id)).toEqual(['box', 'pool']);
    expect(out.containers![0]!.members).toEqual(['a', 'b']);
  });

  it('leaves the data alone for a title edit', () => {
    const out = applyDiagramEdit(DATA, { ...none, containers: [{ kind: 'title', id: 'box' }] });
    expect(out).toEqual(DATA);
  });
});

describe('applyNodeResizes', () => {
  it('stores a resize as the node\'s pinned box', () => {
    const out = applyNodeResizes(DATA, [{ id: 'b', x: 1, y: 2, width: 30, height: 40 }]);
    expect(out.nodes[1]).toEqual({ id: 'b', at: { x: 1, y: 2 }, width: 30, height: 40, pinned: true });
  });
});
