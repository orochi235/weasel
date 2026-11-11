import { describe, expect, it } from 'vitest';
import { graphOf } from './graph';
import { sameGraph } from './livePlan';

const box = { x: 0, y: 0, width: 10, height: 10 };

describe('sameGraph, shrunk', () => {
  it('tells an edge from > to the empty id from one the other way', () => {
    const nodes = [{ id: '>', bounds: box, pinned: false }, { id: '', bounds: box, pinned: false }];
    expect(sameGraph(graphOf(nodes, [{ id: 'e', from: '>', to: '' }]), graphOf(nodes, [{ id: 'e', from: '', to: '>' }]))).toBe(false);
  });
});
