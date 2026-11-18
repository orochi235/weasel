import { describe, it, expect } from 'vitest';
import { force } from './force';
import { boxOf, graphOf, overlaps, placed } from './clusterFixture';

// Two triangles joined by cross edges, and an outsider tied to one of them:
// unclustered, the cross edges pull the two sets through each other.
const IDS = ['a0', 'b0', 'a1', 'b1', 'a2', 'b2', 'x'];
const EDGES = [
  ['a0', 'a1'], ['a1', 'a2'], ['b0', 'b1'], ['b1', 'b2'],
  ['a0', 'b1'], ['b0', 'a1'], ['a1', 'b2'], ['x', 'a2'],
] as const;
const CLUSTERS = { A: ['a0', 'a1', 'a2'], B: ['b0', 'b1', 'b2'] };

describe('force with clusters', () => {
  it('keeps each cluster\'s box clear of the other cluster and of outsiders', () => {
    const at = placed(graphOf(IDS, EDGES, CLUSTERS), force);
    const a = boxOf(at, CLUSTERS.A, 12);
    const b = boxOf(at, CLUSTERS.B, 12);
    expect(overlaps(a, b), `A ${JSON.stringify(a)} B ${JSON.stringify(b)}`).toBe(false);
    expect(overlaps(a, at.get('x')!)).toBe(false);
    expect(overlaps(b, at.get('x')!)).toBe(false);
  });

  it('pushes an outsider out of the box of a cluster it is chained between', () => {
    const at = placed(graphOf(['a', 'm', 'b'], [['a', 'm'], ['m', 'b']], { G: ['a', 'b'] }), force);
    expect(overlaps(boxOf(at, ['a', 'b'], 12), at.get('m')!)).toBe(false);
  });

  it('separates two clusters whose members alternate along a chain', () => {
    const clusters = { A: ['a0', 'a1'], B: ['b0', 'b1'] };
    const at = placed(
      graphOf(['a0', 'b0', 'a1', 'b1'], [['a0', 'b0'], ['b0', 'a1'], ['a1', 'b1']], clusters),
      force,
    );
    expect(overlaps(boxOf(at, clusters.A, 12), boxOf(at, clusters.B, 12))).toBe(false);
  });

  it('holds a cluster\'s members closer together than it leaves them unclustered', () => {
    // No edge inside the cluster: only the cluster itself can be drawing them in.
    const ids = ['a', 'b', 'c', 'm', 'n'];
    const edges = [['a', 'm'], ['b', 'n'], ['c', 'm']] as const;
    const spread = (at: Map<string, { x: number; y: number }>) => {
      const ps = ['a', 'b', 'c'].map((id) => at.get(id)!);
      return Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x))
        + Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    };
    const clustered = spread(placed(graphOf(ids, edges, { G: ['a', 'b', 'c'] }), force));
    const loose = spread(placed(graphOf(ids, edges, {}), force));
    expect(clustered).toBeLessThan(loose);
  });

  it('gives the same answer twice', () => {
    const one = force(graphOf(IDS, EDGES, CLUSTERS));
    const two = force(graphOf(IDS, EDGES, CLUSTERS));
    expect([...one.entries()]).toEqual([...two.entries()]);
  });

  it('never moves a pinned member', () => {
    const graph = graphOf(IDS, EDGES, CLUSTERS);
    const moved = force(graph, { pin: ['a0'] });
    expect(moved.has('a0')).toBe(false);
  });
});
