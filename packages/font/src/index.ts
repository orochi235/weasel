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
  listFonts,
  _resetFontRegistryForTests,
} from './registerFont';
export type { FontEntry, FontVariant, ResolveResult, RegisteredFont } from './registerFont';

export {
  setFontFallbackPolicy,
  getFontFallbackPolicy,
  setDefaultFontFamily,
  getDefaultFontFamily,
} from './fallback';
export type { FontFallbackPolicy } from './fallback';

export {
  registerCanvasFont,
  unregisterCanvasFont,
  isCanvasFont,
  subscribeGlyphReady,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  resetBakeBudget,
  DEFAULT_BAKE_BUDGET,
  _getPagesForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from './dynamic/dynamicAtlas';

export type { GlyphTextureSink, TexSource } from './textureSink';
export {
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_FRAG_R8_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
} from './textSdf';
