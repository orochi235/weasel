export { parseBmFont, FIXTURE_FONT } from './FontAtlas';
export type { BmFont, BmFontChar, BmFontInfo, BmFontCommon, BmFontKerning } from './FontAtlas';

export { layoutGlyphs, quadsToVertexBuffer, buildQuadIndexBuffer } from './GlyphLayout';
export type { GlyphQuad, GlyphLayoutStyle, GlyphLayoutOrigin } from './GlyphLayout';

export {
  registerFont,
  getFont,
  ensureFontTexture,
  textureCacheKey,
  markAllFontsNotUploaded,
  resolveFontVariant,
  _resetFontRegistryForTests,
} from './registerFont';
export type { FontEntry, FontVariant, ResolveResult } from './registerFont';

export {
  registerCanvasFont,
  unregisterCanvasFont,
  isCanvasFont,
  getDynamicFace,
  subscribeGlyphReady,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  resetBakeBudget,
  PAGE_SIZE,
  MAX_PAGES,
  SDF_RADIUS,
  SDF_CUTOFF,
  DEFAULT_BAKE_BUDGET,
  _getPagesForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from './dynamic/dynamicAtlas';
export type { DynamicFace } from './dynamic/dynamicAtlas';

export type { GlyphTextureSink, TexSource } from './textureSink';
export {
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_FRAG_R8_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
} from './textSdf';
