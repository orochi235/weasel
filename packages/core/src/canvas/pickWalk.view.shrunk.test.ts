/** Counterexamples `pickWalk.view.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { AUTO_POSE_DESCRIPTOR as d } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { pickWalk, scenePickSource } from './pickWalk';
import { mixedScene, regionPick } from './pickIndex/pickIndexFixture';

describe('a marquee named from its far corner', () => {
  it('takes what the same rect named from its near corner takes', () => {
    const src = scenePickSource(mixedScene(3, false) as never, { index: { descriptor: d } });
    const near = pickWalk(src, regionPick(rectRegion({ x: 0, y: 0, width: 11, height: 21 }), 'intersect', d));
    expect(near).toEqual(['frame.b']);
    expect(pickWalk(src, regionPick(rectRegion({ x: 11, y: 21, width: -11, height: -21 }), 'intersect', d))).toEqual(near);
  });
});
