/**
 * Reset seams for tests in other packages. They live here rather than on the
 * package barrel so that reaching for one is a deliberate import of a test
 * surface, not something an application finds by autocomplete.
 *
 * @packageDocumentation
 */

export { __resetAdoptedCss } from './adoptCss';
