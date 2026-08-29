/**
 * Reset seams for tests in other packages.
 *
 * The layout cache is module state that changes what renders, so a renderer
 * test asserting what a frame laid out has to be able to empty it. It lives
 * here rather than on the package barrel so that reaching for it is a
 * deliberate import of a test surface, not something an application finds by
 * autocomplete.
 */

export { _resetLayoutCacheForTests } from './layout/layoutCache';
