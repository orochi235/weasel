/**
 * Seams for tests in other packages, each named `…ForTests`.
 *
 * The paint-kind and stroke-marker registries are global module state that
 * changes what renders, so a test that registers into one has to be able to
 * put it back. Path edit's dep source and a stub of its dep let a package
 * building on path edit test against the real thing, and a fake adapter's
 * flat tree lets one test a commit through ops. A snap session built straight
 * from a scene lets a package's snap source be tested without mounting a
 * canvas. The insert dep's source and the area hit test let a package's
 * drawing tool commit and pick against a scene of its own. These live here rather than on the package barrel so that reaching
 * for them is a deliberate import of a test surface, not something an
 * application finds by autocomplete.
 *
 * @packageDocumentation
 */

import { _resetPaintDrawKindsForTests } from '@weasel-js/renderer/test-seams';
import { _reseedPaintKinds } from 'core/paint/paintKinds';

/** The paint-kind registry, and the renderer's draw half of it, back to the built-ins alone. */
export function _resetPaintKindsForTests(): void {
  _resetPaintDrawKindsForTests();
  _reseedPaintKinds();
}

export { _resetMarkersForTests } from '@weasel-js/stroke/test-seams';
export { makeEditAnchorsDep as createEditAnchorsDepForTests, stubDeps as stubDepsForTests } from 'interactions/actions/testUtils';
export {
  useEditAnchorsDepSource as useEditAnchorsDepSourceForTests, type EditAnchorsStateRef,
} from 'canvas/deps/editAnchors';
export type { AnchorMarquee, PathEditState } from 'domains/paths/pathEditState';
export { rootsTree as rootsTreeForTests } from 'core/adapters/testing/rootsTree';
export {
  createSnapSession2d as createSnapSession2dForTests, type SnapSession2dOptions,
} from 'domains/snap/sceneSession2d';
export {
  gridSource as gridSnapSourceForTests, sceneOfPaths as sceneOfPathsForTests, sessionDep as snapSessionDepForTests,
} from 'domains/snap/testing/sessionDep';
export {
  hitTestArea as hitTestAreaForTests, type AABBBounds, type RegionQueryOptions,
} from 'canvas/deps/hitTestArea';
export type { ScenePickSourceOptions, ViewPickGates } from 'canvas/pickWalk';
export { useInsertDepSource as useInsertDepSourceForTests } from 'canvas/deps/insert';

export { FRAME_FIXTURE_IDS as FRAME_FIXTURE_IDSForTests, FRAME_FIXTURE_LOCAL as FRAME_FIXTURE_LOCALForTests, expectSamePose as expectSamePoseForTests, makeFrameFixture as makeFrameFixtureForTests } from '../core/scene/frameFixture';

export { runs as pbtRunsForTests, tally as pbtTallyForTests, timeoutFor as pbtTimeoutForTests } from 'interactions/actions/pbt.fixture';

export { CIRCLE_POSE_DESCRIPTOR as CIRCLE_POSE_DESCRIPTORForTests, circle as circleForTests } from '../core/geometry/circlePose.fixture';
export type { CirclePose as CirclePoseForTests } from '../core/geometry/circlePose.fixture';
export { FRAME_FIXTURE_WORLD as FRAME_FIXTURE_WORLDForTests } from '../core/scene/frameFixture';
export { _resetContentHandlersForTests } from 'domains/ingestion/contentHandlers';
