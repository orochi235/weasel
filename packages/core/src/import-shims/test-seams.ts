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

export { _resetMarkersForTests } from '@weasel-js/stroke/test-seams';
export { makeEditAnchorsDep as createEditAnchorsDepForTests, stubDeps as stubDepsForTests } from 'interactions/actions/testUtils';
export {
  useEditAnchorsDepSource as useEditAnchorsDepSourceForTests, type EditAnchorsStateRef,
} from 'canvas/deps/editAnchors';
export type { PathEditState } from 'domains/paths/pathEditState';
export { rootsTree as rootsTreeForTests } from 'core/adapters/testing/rootsTree';
export {
  createSnapSession2d as createSnapSession2dForTests, type SnapSession2dOptions,
} from 'domains/snap/sceneSession2d';
export {
  gridSource as gridSnapSourceForTests, sceneOfPaths as sceneOfPathsForTests, sessionDep as snapSessionDepForTests,
} from 'domains/snap/testing/sessionDep';
export {
  hitTestRect as hitTestRectForTests, type RegionQueryOptions,
} from 'canvas/deps/hitTestArea';
export type { ScenePickSourceOptions, ViewPickGates } from 'canvas/pickWalk';

export { FRAME_FIXTURE_IDS as FRAME_FIXTURE_IDSForTests, FRAME_FIXTURE_LOCAL as FRAME_FIXTURE_LOCALForTests, expectSamePose as expectSamePoseForTests, makeFrameFixture as makeFrameFixtureForTests } from '../core/scene/frameFixture';

export { runs as pbtRunsForTests, tally as pbtTallyForTests, timeoutFor as pbtTimeoutForTests } from 'interactions/actions/pbtScene.fixture';

export { CIRCLE_POSE_DESCRIPTOR as CIRCLE_POSE_DESCRIPTORForTests, circle as circleForTests } from '../core/geometry/circlePose.fixture';
export type { CirclePose as CirclePoseForTests } from '../core/geometry/circlePose.fixture';
export { FRAME_FIXTURE_WORLD as FRAME_FIXTURE_WORLDForTests } from '../core/scene/frameFixture';
export { _resetContentHandlersForTests } from 'domains/ingestion/contentHandlers';
export type { FrameFixtureData as FrameFixtureDataForTests, FrameFixtureLayer as FrameFixtureLayerForTests } from '../core/scene/frameFixture';

export { assertFinite as assertFiniteForTests, drive as driveForTests } from '../interactions/actions/drag.pbt.fixture';
export type { Pt as PtForTests } from '../interactions/actions/drag.pbt.fixture';
export { depsOf as depsOfForTests, makeScene as makeSceneForTests, runs as runsForTests, tally as tallyForTests, timeoutFor as timeoutForForTests } from '../interactions/actions/pbtScene.fixture';
export type { TestScene as TestSceneForTests } from '../interactions/actions/pbtScene.fixture';

export { ON_PAGE as ON_PAGEForTests, PAGE_A as PAGE_AForTests, PAGE_B as PAGE_BForTests, pagedScene as pagedSceneForTests } from '../core/pages/pagedFixture';
export { gridSource as gridSourceForTests, lineSource as lineSourceForTests, sessionDep as sessionDepForTests } from '../domains/snap/testing/sessionDep';
export { dragCtx as dragCtxForTests, handleAffordance as handleAffordanceForTests } from '../interactions/actions/drag.pbt.fixture';
export type { Gesture as GestureForTests } from '../interactions/actions/drag.pbt.fixture';
export { heldPose as heldPoseForTests, moveEnd as moveEndForTests } from '../interactions/actions/testUtils';

export { createGestureSource as createGestureSourceForTests } from '../canvas/SceneCanvas/dispatcherGestureBounds';
export { usePreviewGhostLayer as usePreviewGhostLayerForTests } from '../canvas/SceneCanvas/usePreviewGhostLayer';

export { pointRegionScreenQuad as pointRegionScreenQuadForTests } from '../affordances/hitAffordanceRegions';

export { mergeLayersWithDefaults as mergeLayersWithDefaultsForTests } from '../canvas/SceneCanvas';
export { useSelectionOverlayLayer as useSelectionOverlayLayerForTests } from '../canvas/SceneCanvas/useSelectionOverlayLayer';
export { buildAffordanceAt as buildAffordanceAtForTests, chromeAffordances as chromeAffordancesForTests } from '../canvas/affordanceAt';
export { createSlopsDebugLayer as createSlopsDebugLayerForTests } from '../canvas/slopsDebugLayer';
export { useViewHelpers as useViewHelpersForTests } from '../canvas/useViewHelpers';
export type { UseViewHelpersOptions as UseViewHelpersOptionsForTests } from '../canvas/useViewHelpers';
export { ViewInputsProvider as ViewInputsProviderForTests } from '../canvas/viewInputs';
export { ViewRegistryProvider as ViewRegistryProviderForTests, useOptionalViewRegistry as useOptionalViewRegistryForTests } from '../canvas/viewRegistry';
export type { ViewRegistry as ViewRegistryForTests } from '../canvas/viewRegistry';
export { targetSizesPx as targetSizesPxForTests } from '../core/device/targets';
export type { TargetSizesPx as TargetSizesPxForTests } from '../core/device/targets';

export { getContentHandlers as getContentHandlersForTests } from '../domains/ingestion/contentHandlers';

export { dispatcherInsertBounds as dispatcherInsertBoundsForTests } from '../canvas/SceneCanvas/dispatcherGestureBounds';
export { presetActions as presetActionsForTests, presetAmbient as presetAmbientForTests, presetBuiltinTools as presetBuiltinToolsForTests, presetChromeRules as presetChromeRulesForTests, presetOwnTools as presetOwnToolsForTests, presetToolIds as presetToolIdsForTests, resolveFeatures as resolveFeaturesForTests } from '../canvas/SceneCanvas/features';
export { layersOverPresets as layersOverPresetsForTests } from '../canvas/SceneCanvas/mergeLayers';
export { useDispatcherOverlayLayer as useDispatcherOverlayLayerForTests } from '../canvas/SceneCanvas/useDispatcherOverlayLayer';
export { buildSceneLayer as buildSceneLayerForTests } from '../canvas/buildSceneLayer';
export { siteIn as siteInForTests } from '../canvas/deps/insertSite';
export { useOptionalViewInputs as useOptionalViewInputsForTests } from '../canvas/viewInputs';
export type { SurfaceViewInputs as SurfaceViewInputsForTests } from '../canvas/viewInputs';
export { legalSelection as legalSelectionForTests, settleSelection as settleSelectionForTests } from '../core/selection/legalSelection';
export { icons as iconsForTests } from '../icons.table';

export type { BuildAffordanceAtOptions, ChromeAffordanceOptions } from '../canvas/affordanceAt';
export type { ChromeCaps, ViewRuleInputs } from '../domains/chrome-caps/useChromeCaps';
export type { CreateSlopsDebugLayerOptions } from '../canvas/slopsDebugLayer';
export type { DispatcherOverlayStyle } from '../canvas/SceneCanvas/useDispatcherOverlayLayer';
export type { EnabledPresets } from '../canvas/SceneCanvas/features';
export type { HierarchicalAdapter } from '../canvas/buildSceneTree';
export type { PickView } from '../canvas/SceneCanvas/useScenePickers';
export type { Selectable } from '../core/selection/legalSelection';
export type { SurfaceHandle, ViewRegistration } from '../canvas/viewRegistry';
export type { ViewMarkerRegistry } from '../canvas/viewMarkers';
export type { ViewHelpersBundle } from '../canvas/useViewHelpers';
