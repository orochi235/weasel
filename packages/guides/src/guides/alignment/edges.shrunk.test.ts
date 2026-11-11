import { describe, expect, it } from 'vitest';
import { alignmentSnapSource } from '../../sources/alignment';
import { spacingSnapSource } from '../../sources/spacing';
import { moveBy, sceneOf } from '../../sources/testing/session';
import { deriveAlignmentGuides } from './derive';
import { matchSpacing, measureGaps } from './spacing';

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

  it('spaces a box among siblings alike with a sibling of NaN width among them', () => {
    const moving = { x: 0, y: 0, width: 1, height: 1 };
    const sibs = [{ x: -2.25, y: 0, width: 1, height: 1.125 }, { x: 0, y: 0, width: 1, height: 1 }];
    const worse = { x: 0, y: 0, width: NaN, height: 1.125 };
    const run = (others: object[]) => {
      const { scene, ids } = sceneOf([moving, ...others] as never);
      return moveBy({ sources: [alignmentSnapSource(), spacingSnapSource()], scene, ids: [ids[0]!], reachPx: 8 }).by(-1.125, 1).point;
    };
    expect(run([...sibs, worse])).toEqual(run(sibs));
    expect(run([worse, ...sibs])).toEqual(run(sibs));
    expect(measureGaps([...sibs, worse], 'x')).toEqual(measureGaps(sibs, 'x'));
    expect(matchSpacing({ x: 3, y: 0, width: 1, height: 1 }, [{ x: 0, y: 0, width: 1, height: 1 }, { x: 1.5, y: 0, width: 1, height: 1 }, worse], { x: 8, y: 8 }).dx)
      .toBe(matchSpacing({ x: 3, y: 0, width: 1, height: 1 }, [{ x: 0, y: 0, width: 1, height: 1 }, { x: 1.5, y: 0, width: 1, height: 1 }], { x: 8, y: 8 }).dx);
  });

  it('spaces nowhere under a NaN tolerance', () => {
    // A comparison with NaN is false, so no placement was too far, and the box moved 1 to the gap.
    const out = matchSpacing({ x: 0, y: 0, width: 1, height: 1 }, [{ x: 0, y: 0, width: 1, height: 1 }, { x: -1.125, y: 0, width: 1, height: 1 }], { x: NaN, y: NaN });
    expect(out).toEqual({ dx: 0, dy: 0, gapsX: [], gapsY: [] });
  });
});
