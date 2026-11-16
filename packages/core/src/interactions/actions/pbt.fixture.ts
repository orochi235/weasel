/**
 * fast-check helpers shared by the interaction actions' property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { RectPose } from 'core/geometry/rectPose';

export { depsOf, makeScene, runs, tally, timeoutFor, type TestScene } from './pbtScene.fixture';

/** A rect pose on a coarse grid, so every align and nudge lands exactly. */
export const rectPose: fc.Arbitrary<RectPose> = fc.record({
  x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 1, max: 60 }), height: fc.integer({ min: 1, max: 60 }),
});
