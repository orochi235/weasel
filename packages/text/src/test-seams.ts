/**
 * Reset seams for tests in other packages.
 *
 * The layout cache is module state that changes what renders, so a renderer
 * test asserting what a frame laid out has to be able to empty it, and the
 * missing-engine warning fires once per process. They live here rather than on
 * the package barrel so that reaching for one is a deliberate import of a test
 * surface, not something an application finds by autocomplete.
 *
 * @packageDocumentation
 */

export { _resetLayoutCacheForTests } from './layout/layoutCache';
export { _resetBidiWarningForTests } from './layout/bidiRegistry';
