import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { diagramPages } from './dataPages';
import { diagramScene, type DataNode, type DiagramData } from './fromData';
import { withDiagramRegistry } from './edge';
import { diagramEdgeOf } from './edgeTrait';
import { offPageTagOf } from './offPage/trait';

/** Two 200×100 pages side by side: `p1` spans x 0..200, `p2` x 240..440. */
const TWO_PAGES = { pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }] } as const;
const node = (id: string, x: number): DataNode => ({ id, lines: [id], width: 30, at: { x, y: 20 } });

/** Nodes, a labeled edge, a group, a container, and an edge from a group. */
const MIXED: DiagramData = {
  nodes: [
    { id: 'a', lines: ['level mix', '0–1'] },
    { id: 'b', lines: ['warm'] },
    { id: 'c', lines: ['color', 'hex'] },
    { id: 'd', lines: ['in region'] },
  ],
  edges: [{ from: 'a', to: 'b', label: 'weight' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'g', to: 'a' }],
  groups: [{ id: 'g', members: ['b', 'c'], label: 'pair' }],
  containers: [{ id: 'r', role: 'container', label: 'region', members: ['d'] }],
};

type Specs = ReturnType<typeof diagramScene>;
const edgeOf = (specs: Specs, id: string) => specs.find((s) => s.id === id && diagramEdgeOf(s) !== null)!;
const tagIds = (specs: Specs) => specs.filter((s) => offPageTagOf(s) !== null).map((s) => s.id);

describe('diagramScene with pages', () => {
  it('places the pages as layoutPages does', () => {
    expect(diagramPages(TWO_PAGES as unknown as DiagramData).map((p) => [p.id, p.x])).toEqual([['p1', 0], ['p2', 240]]);
  });

  it('splits an edge between pages and tags both ends', () => {
    const specs = diagramScene({ ...TWO_PAGES, nodes: [node('a', 20), node('b', 300)], edges: [{ from: 'a', to: 'b' }] }, { layout: 'none' });
    const edge = specs.find((s) => diagramEdgeOf(s) !== null)!;
    expect(diagramEdgeOf(edge)!.offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(tagIds(specs)).toEqual([`${edge.id}/offpage-from`, `${edge.id}/offpage-to`]);
    const scene = createScene({ systemLayers: [{ id: 'main' as const }], initial: specs, registry: withDiagramRegistry<RectPose>() });
    expect(scene.get(`${edge.id}/offpage-to` as never)).toBeDefined();
  });

  it('leaves an edge with an end in the gap whole', () => {
    const specs = diagramScene({ ...TWO_PAGES, nodes: [node('a', 20), node('b', 205)], edges: [{ from: 'a', to: 'b' }] }, { layout: 'none' });
    const edge = specs.find((s) => diagramEdgeOf(s) !== null)!;
    const b = specs.find((s) => s.id === 'b')!.pose as { x: number; width: number };
    expect(b.x + b.width).toBeLessThanOrEqual(240);
    expect(diagramEdgeOf(edge)!.offPage).toBeUndefined();
    expect(tagIds(specs)).toEqual([]);
  });

  it('changes nothing for no pages, pages: [], or one page holding every node', () => {
    const none = diagramScene(MIXED);
    const onePage = diagramScene({ ...MIXED, pages: [{ id: 'p', width: 10000, height: 10000 }], pageLayout: { origin: { x: -5000, y: -5000 } } });
    expect(diagramScene({ ...MIXED, pages: [] })).toEqual(none);
    expect(onePage).toEqual(none);
    expect(onePage.some((s) => diagramEdgeOf(s)?.offPage !== undefined)).toBe(false);
    expect(tagIds(onePage)).toEqual([]);
  });

  it('letters split edges in data order, and re-letters when one goes', () => {
    const nodes = [node('a', 20), node('b', 300), node('c', 100), node('d', 380)];
    const both = diagramScene({ ...TWO_PAGES, nodes, edges: [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }] }, { layout: 'none' });
    expect(diagramEdgeOf(edgeOf(both, 'edge:a->b'))!.offPage?.ref).toBe('A');
    expect(diagramEdgeOf(edgeOf(both, 'edge:c->d'))!.offPage?.ref).toBe('B');
    const one = diagramScene({ ...TWO_PAGES, nodes, edges: [{ from: 'c', to: 'd' }] }, { layout: 'none' });
    expect(diagramEdgeOf(edgeOf(one, 'edge:c->d'))!.offPage?.ref).toBe('A');
  });

  it('splits an edge ending at a group by the group’s box', () => {
    // `b` alone sits on p1; the group's box, with `c` and `e`, is mostly on p2.
    const specs = diagramScene({
      ...TWO_PAGES,
      nodes: [node('a', 20), node('b', 170), node('c', 260), node('e', 330)],
      groups: [{ id: 'g', members: ['b', 'c', 'e'] }],
      edges: [{ from: 'a', to: 'g' }, { from: 'a', to: 'b' }],
    }, { layout: 'none' });
    expect(diagramEdgeOf(edgeOf(specs, 'edge:a->g'))!.offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(diagramEdgeOf(edgeOf(specs, 'edge:a->b'))!.offPage).toBeUndefined();
  });

  it('splits an edge ending at a container by the container’s box', () => {
    const specs = diagramScene({
      ...TWO_PAGES,
      nodes: [node('a', 20), node('b', 170), node('c', 260), node('e', 330)],
      containers: [{ id: 'r', role: 'container', members: ['b', 'c', 'e'] }],
      edges: [{ from: 'a', to: 'r' }, { from: 'a', to: 'b' }],
    }, { layout: 'none' });
    expect(diagramEdgeOf(edgeOf(specs, 'edge:a->r'))!.offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(diagramEdgeOf(edgeOf(specs, 'edge:a->b'))!.offPage).toBeUndefined();
  });

  it('splits an edge ending at a lane by the lane’s box', () => {
    // The pool spans both pages; lane `l1` is p1's side of it and `l2` is p2's.
    const specs = diagramScene({
      ...TWO_PAGES,
      nodes: [node('a', 20), node('b', 110), node('c', 300)],
      containers: [{
        id: 'pool', role: 'pool', axis: 'x', box: { x: 100, y: 10, width: 340, height: 80 },
        lanes: [{ id: 'l1', size: 150, members: ['b'] }, { id: 'l2', size: 190, members: ['c'] }],
      }],
      edges: [{ from: 'a', to: 'l2' }, { from: 'a', to: 'l1' }],
    }, { layout: 'none' });
    expect(diagramEdgeOf(edgeOf(specs, 'edge:a->l2'))!.offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(diagramEdgeOf(edgeOf(specs, 'edge:a->l1'))!.offPage).toBeUndefined();
  });
});
