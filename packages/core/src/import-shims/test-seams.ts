/**
 * Reset seams for tests in other packages.
 *
 * The paint-kind and stroke-marker registries are global module state that
 * changes what renders, so a test that registers into one has to be able to
 * put it back. These live here rather than on the package barrel so that
 * reaching for them is a deliberate import of a test surface, not something an
 * application finds by autocomplete.
 */

export { _resetPaintKindsForTests } from '../core/paintKinds';
export { _resetMarkersForTests } from '../core/strokeMarkers';
