/**
 * Reset seams for tests in other packages.
 *
 * Font registration, the fallback policy, the dynamic atlas and the outline
 * registry are all global module state that changes what renders, so a test in
 * `@weasel-js/core` or `@weasel-js/hud` that sets one has to be able to put it
 * back. These live here rather than on the package barrel so that reaching for
 * them is a deliberate import of a test surface, not something an application
 * finds by autocomplete.
 */

export { _resetFontRegistryForTests } from './registerFont';
export { _resetFallbackForTests } from './fallback';
export {
  _getPagesForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from './dynamic/dynamicAtlas';
export { _resetFontOutlinesForTests } from './outline/outlineRegistry';
