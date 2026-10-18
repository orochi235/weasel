/**
 * `@weasel-js/font/metrics` — the half of this package that reads numbers.
 *
 * Parsing an atlas's metrics, deriving a face's line and script metrics from
 * its tables, and naming a family for a CSS `font` shorthand all run without a
 * browser, so a server measuring or laying out text can import them. The
 * barrel cannot serve that: the registry it carries loads faces through
 * `document.fonts` and rasterizes through a canvas.
 *
 * @packageDocumentation
 */

export { parseBmFont, FIXTURE_FONT } from './FontAtlas';
export type { BmFont, BmFontChar, BmFontInfo, BmFontCommon, BmFontKerning } from './FontAtlas';

export { faceMetricsFromTables, faceMetricsOf, verticalMetricsFromTables } from './faceMetrics';
export type { FaceMetrics, FaceRuleMetrics, FaceScriptMetrics, FaceMetricTables } from './faceMetrics';

export { cssFamilyName } from './cssFamily';
export type { FontStyle } from './fontStyle';
