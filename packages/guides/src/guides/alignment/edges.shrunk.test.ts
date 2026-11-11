import { describe, expect, it } from 'vitest';
import { alignmentSnapSource } from '../../sources/alignment';
import { moveBy, sceneOf } from '../../sources/testing/session';
import { deriveAlignmentGuides } from './derive';

describe('alignment and spacing at the edges, shrunk from the property tests', () => {
  it('derives no line from a box with a coordinate that is not finite', () => {
    // It derived three lines at NaN, named `align:x:NaN`, `~2`, and `~3`.
    const got = deriveAlignmentGuides([{ x: 0, y: 0, width: 1, height: 1 }, { x: NaN, y: 0, width: 0, height: 0 }]);
    expect(got.map((g) => g.offset)).toEqual([0, 1, 0.5, 0, 1, 0.5]);
  });

  it('snaps a box to a line a sibling with an infinite width stands beside', () => {
    // The sibling's lines at -Infinity sorted every line out of order, and the line at 0 was missed.
    for (const order of [[1, 2], [2, 1]]) {
      const sibs = [{ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: -Infinity, height: 0 }];
      const { scene, ids } = sceneOf([{ x: 0, y: 0, width: 1, height: 1 }, ...order.map((i) => sibs[i - 1]!)]);
      expect(moveBy({ sources: [alignmentSnapSource()], scene, ids: [ids[0]!], reachPx: 8 }).by(0.125, 0).point).toEqual({ x: 0, y: 0 });
    }
  });
});
