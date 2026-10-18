/**
 * Seams for tests in other packages, each named `…ForTests`.
 *
 * The paint-kind and stroke-marker registries are global module state that
 * changes what renders, so a test that registers into one has to be able to
 * put it back. Path edit's dep source and a stub of its dep let a package
 * building on path edit test against the real thing, and a fake adapter's
 * flat tree lets one test a commit through ops. A snap session built straight
 * from a scene lets a package's snap source be tested without mounting a canvas. These live here rather
 * than on the package barrel so that reaching for them is a deliberate import
 * of a test surface, not something an application finds by autocomplete.
 *
 * @packageDocumentation
 */

export { _resetPaintKindsForTests } from 'core/paint/paintKinds';
export { _resetMarkersForTests } from '@weasel-js/stroke/test-seams';
export { makeEditAnchorsDep as makeEditAnchorsDepForTests } from 'interactions/actions/testUtils';
export {
  useEditAnchorsDepSource as useEditAnchorsDepSourceForTests, type EditAnchorsStateRef,
} from 'canvas/deps/editAnchors';
export { rootsTree as rootsTreeForTests } from 'core/adapters/testing/rootsTree';
export {
  createSnapSession2d as createSnapSession2dForTests, type SnapSession2dOptions,
} from 'features/snap/sceneSession2d';
