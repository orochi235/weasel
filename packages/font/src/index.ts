// The published surface of this package. Deliberately narrower than the sum of
// its modules' exports: adding an export later is free, removing one is
// breaking. Internal tuning constants and implementation entry points stay
// internal even though their modules export them for in-package use.

export { parseBmFont, FIXTURE_FONT } from './FontAtlas';
export type { BmFont, BmFontChar, BmFontInfo, BmFontCommon, BmFontKerning } from './FontAtlas';

export { faceMetricsFromTables, faceMetricsOf, verticalMetricsFromTables } from './faceMetrics';
export type { FaceMetrics, FaceRuleMetrics, FaceScriptMetrics, FaceMetricTables } from './faceMetrics';

export {
  registerFont,
  getFont,
  faceMetricsFor,
  ensureFontTexture,
  textureCacheKey,
  markAllFontsNotUploaded,
  resolveFontVariant,
  resolveGlyphFallback,
  listFonts,
  listFontWeights,
  fontRegistry,
  fontPending,
  warmFonts,
} from './registerFont';
export type {
  FontEntry, FontFamilyFaces, FontVariant, FontRequest, ResolveResult, RegisteredFont, RegisterFontOptions,
} from './registerFont';

export {
  setFontFallbackPolicy,
  getFontFallbackPolicy,
  setDefaultFontFamily,
  getDefaultFontFamily,
} from './fallback';
export type { FontFallbackPolicy } from './fallback';

export { subscribeGlyphReady, glyphGeneration, faceGeneration } from './glyphReady';

export { cssFontFamily, cssFontFamilyLoading } from './domFace';
export { cssFamilyName } from './cssFamily';

export {
  registerCanvasFont,
  unregisterCanvasFont,
  refreshCanvasFont,
  isCanvasFont,
  listCanvasFonts,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  syncColorPageTexture,
  colorPageTextureId,
  syncSharpColorPageTexture,
  sharpColorPageTextureId,
  sharperColorGlyph,
  MAX_SHARP_LEVEL,
  PAGE_SIZE as DYNAMIC_PAGE_SIZE,
  resetBakeBudget,
  DEFAULT_BAKE_BUDGET,
} from './dynamic/dynamicAtlas';

export type { CanvasFontEntry, DynamicFace, SharperColorGlyph } from './dynamic/dynamicAtlas';

export {
  registerFontOutlines,
  unregisterFontOutlines,
  hasFontOutlines,
  outlineStatus,
  listFontOutlines,
  fontOutlineRegistry,
  glyphOutline,
  outlineMetrics,
  loadFontOutlines,
} from './outline/outlineRegistry';
export type {
  OutlineSource,
  OutlineVariant,
  OutlineFontOptions,
  OutlineStatus,
  OutlineFaceInfo,
} from './outline/outlineRegistry';
export type { OutlineFace, OutlineParser, FaceEmbedding } from './outline/OutlineFace';
export { fontEmbedding } from './outline/fontEmbedding';
export { metricsOf } from './glyphMetrics';
export type { GlyphMetrics } from './glyphMetrics';
export { glyphIn, resolveGlyph, resolveColorCluster } from './resolveGlyph';
export type { ResolvedGlyph } from './resolveGlyph';
export { warnNoMetrics } from './glyphWarnings';
export type { FontStyle } from './fontStyle';
export {
  enableLocalFontOutlines,
  canQueryLocalFonts,
  parseFontStyle,
} from './outline/localFonts';
export type {
  LocalFontOutlinesOptions,
  LocalFontOutlinesResult,
} from './outline/localFonts';

export type { GlyphTextureSink, TexSource } from './textureSink';
export {
  GLYPH_COVERAGE_GLSL,
  GLYPH_POINT_COVERAGE_GLSL,
  GLYPH_MODE_MSDF,
  GLYPH_MODE_R8,
  glyphFieldScale,
  glyphNeedsArea,
  SYNTH_BOLD_AMOUNT,
  syntheticBoldGrowth,
} from './textSdf';
