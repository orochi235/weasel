import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import baseline from './fromData.pages.baseline.json';
import { BASELINE_DATA, serialize } from './fromData.pages.fixture';
import { diagramPages } from './dataPages';
import { diagramScene, type DataNode, type DiagramData } from './fromData';
import { withDiagramRegistry } from './edge';
import { diagramEdgeOf } from './edgeTrait';
import { offPageTagOf } from './offPage/trait';

/** Two 200×100 pages side by side: `p1` spans x 0..200, `p2` x 240..440. */
const TWO_PAGES = { pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }] } as const;
const node = (id: string, x: number): DataNode => ({ id, lines: [id], width: 30, at: { x, y: 20 } });

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
    const scene = createScene({ systemLayers: [{ id: 'main' as const }], initial: specs, registry: withDiagramRegistry() });
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

  it('returns today’s specs for data with no pages or pages: []', () => {
    const none = serialize(diagramScene(BASELINE_DATA));
    expect(none).toEqual(baseline);
    expect(serialize(diagramScene({ ...BASELINE_DATA, pages: [] }))).toEqual(baseline);
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
});
