import { describe, expect, it } from 'vitest';
import type { GraphPage } from '../document';
import { sortedPage } from './samePage';

const page = (lanes: string[], clusters: string[]): GraphPage => ({
  kind: 'graph', id: 'p', width: 10, height: 10,
  data: {
    nodes: [], edges: [],
    containers: [{ id: 'pool', role: 'pool', lanes: lanes.map((id) => ({ id })) }],
    clusters: clusters.map((id) => ({ id, members: ['y', 'x'] })),
  },
});

describe('sortedPage', () => {
  it('keeps a pool\'s lane order, which is drawn order', () => {
    expect(sortedPage(page(['b', 'a'], []))).not.toEqual(sortedPage(page(['a', 'b'], [])));
  });

  it('ignores the order clusters and their members were listed in', () => {
    expect(sortedPage(page([], ['g', 'f']))).toEqual(sortedPage(page([], ['f', 'g'])));
    expect(sortedPage(page([], ['g'])).data.clusters![0]!.members).toEqual(['x', 'y']);
  });
});
