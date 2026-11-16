/**
 * fast-check arbitraries for the editing actions' property tests, which `@weasel-js/core/test-seams` cannot hand
 * over without making fast-check a dependency of core. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { RectPose } from '@weasel-js/core';

/** A rect pose on a coarse grid, so every align and nudge lands exactly. */
export const rectPose: fc.Arbitrary<RectPose> = fc.record({
  x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 1, max: 60 }), height: fc.integer({ min: 1, max: 60 }),
});
