/**
 * Seams for tests in other packages.
 *
 * The paint-kind and stroke-marker registries are global module state that
 * changes what renders, so a test that registers into one has to be able to
 * put it back. Path edit's dep source, its anchor actions, and stubs for
 * driving an action by hand let a package building on path edit test against
 * the real thing. These live here rather than on the package barrel so that
 * reaching for them is a deliberate import of a test surface, not something an
 * application finds by autocomplete.
 *
 * @packageDocumentation
 */

export { _resetPaintKindsForTests } from 'core/paint/paintKinds';
export { _resetMarkersForTests } from '@weasel-js/stroke/test-seams';
export { makeEditAnchorsDep, stubDeps } from 'interactions/actions/testUtils';
export { useEditAnchorsDepSource, type EditAnchorsStateRef } from 'canvas/deps/editAnchors';
export {
  deleteAnchorsAction, nudgeAnchorsDownAction, nudgeAnchorsLeftAction, nudgeAnchorsRightAction, nudgeAnchorsUpAction,
  selectAnchorAction,
} from 'interactions/actions/defaults/anchorEditing';
