// The published surface of this package. Deliberately narrower than the sum of
// its modules' exports: adding an export later is free, removing one is
// breaking. Internal tuning constants and implementation entry points stay
// internal even though their modules export them for in-package use.

export { parseBmFont, FIXTURE_FONT } from './FontAtlas';
export type { BmFont, BmFontChar, BmFontInfo, BmFontCommon, BmFontKerning } from './FontAtlas';

export {
  registerFont,
  getFont,
  ensureFontTexture,
  textureCacheKey,
  markAllFontsNotUploaded,
  resolveFontVariant,
  resolveGlyphFallback,
  listFonts,
} from './registerFont';
export type { FontEntry, FontVariant, ResolveResult, RegisteredFont } from './registerFont';

export {
  setFontFallbackPolicy,
  getFontFallbackPolicy,
  setDefaultFontFamily,
  getDefaultFontFamily,
} from './fallback';
export type { FontFallbackPolicy } from './fallback';

export { subscribeGlyphReady, glyphGeneration } from './glyphReady';

export {
  registerCanvasFont,
  unregisterCanvasFont,
  isCanvasFont,
  listCanvasFonts,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  resetBakeBudget,
  DEFAULT_BAKE_BUDGET,
} from './dynamic/dynamicAtlas';

export type { CanvasFontEntry } from './dynamic/dynamicAtlas';

export {
  registerFontOutlines,
  unregisterFontOutlines,
  hasFontOutlines,
  outlineStatus,
  listFontOutlines,
  glyphOutline,
} from './outline/outlineRegistry';
export type {
  OutlineSource,
  OutlineVariant,
  OutlineFontOptions,
  OutlineStatus,
} from './outline/outlineRegistry';
export type { OutlineFace, OutlineParser, OutlineFontStyle } from './outline/OutlineFace';
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
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_FRAG_R8_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
} from './textSdf';
