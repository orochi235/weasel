import { describe, it, expect } from 'vitest';
import { buildGraph, type GraphNodeLike, type GraphSource } from './graph';

interface Rect { x: number; y: number; width: number; height: number }

const box = (x: number, y: number): Rect => ({ x, y, width: 100, height: 40 });

function source(
  entries: readonly { node: GraphNodeLike; pose: Rect }[],
): GraphSource<Rect> {
  return () => entries;
}

const participant = (id: string, data: unknown = { diagram: {} }): GraphNodeLike =>
  ({ id, kind: 'leaf', data });

const edge = (id: string, from: string, to: string): GraphNodeLike => ({
  id,
  kind: 'leaf',
  data: { diagram: { from: {}, to: {} } },
  dependsOn: [from, to],
});

const degenerate: Rect = { x: 0, y: 0, width: 0, height: 0 };

describe('buildGraph', () => {
  it('reads participants and their current bounds', () => {
    const graph = buildGraph(source([
      { node: participant('a'), pose: box(10, 20) },
      { node: participant('b'), pose: box(200, 20) },
    ]));
    expect(graph.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(graph.node('a')!.bounds).toEqual(box(10, 20));
  });

  it('leaves out a node with no diagram trait', () => {
    const graph = buildGraph(source([
      { node: participant('a'), pose: box(0, 0) },
      { node: { id: 'note', kind: 'leaf', data: { text: 'hi' } }, pose: box(0, 0) },
    ]));
    expect(graph.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('reads an edge from its dependencies, not from its trait', () => {
    const graph = buildGraph(source([
      { node: participant('a'), pose: box(0, 0) },
      { node: participant('b'), pose: box(200, 0) },
      { node: edge('e1', 'a', 'b'), pose: degenerate },
    ]));
    expect(graph.edges).toEqual([{ id: 'e1', from: 'a', to: 'b' }]);
    expect(graph.outgoing('a')).toHaveLength(1);
    expect(graph.incoming('b')).toHaveLength(1);
    expect(graph.incoming('a')).toHaveLength(0);
  });

  it('is not fooled into treating an edge as a participant', () => {
    const graph = buildGraph(source([
      { node: participant('a'), pose: box(0, 0) },
      { node: participant('b'), pose: box(200, 0) },
      { node: edge('e1', 'a', 'b'), pose: degenerate },
    ]));
    expect(graph.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('drops an edge whose endpoint is not in the diagram', () => {
    const graph = buildGraph(source([
      { node: participant('a'), pose: box(0, 0) },
      { node: edge('e1', 'a', 'gone'), pose: degenerate },
    ]));
    expect(graph.edges).toEqual([]);
  });

  it('reads `pinned` off the trait', () => {
    const graph = buildGraph(source([
      { node: participant('a', { diagram: { pinned: true } }), pose: box(0, 0) },
      { node: participant('b'), pose: box(200, 0) },
    ]));
    expect(graph.node('a')!.pinned).toBe(true);
    expect(graph.node('b')!.pinned).toBe(false);
  });

  it('keeps adjacency in source order', () => {
    const graph = buildGraph(source([
      { node: participant('a'), pose: box(0, 0) },
      { node: participant('b'), pose: box(200, 0) },
      { node: participant('c'), pose: box(400, 0) },
      { node: edge('e2', 'a', 'c'), pose: degenerate },
      { node: edge('e1', 'a', 'b'), pose: degenerate },
    ]));
    expect(graph.outgoing('a').map((e) => e.id)).toEqual(['e2', 'e1']);
  });
});
