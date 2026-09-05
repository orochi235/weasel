/**
 * Renderer barrel. WeaselRenderer + DrawCommand types for
 * solid/pattern/gradient-fill paths, groups (with optional color matrix
 * and per-vertex color), strokes, MSDF text, images, plus an experimental
 * custom shader API (registerProgram, registerTexture, kind:'shader').
 */

export { WeaselRenderer, type WeaselRendererOptions, type RenderTarget } from './WeaselRenderer';
export type { ImageMinification } from './cache/GLImageCache';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  SpritesDrawCommand,
  ShaderDrawCommand,
  SolidPaint,
} from './DrawCommand';
export { SPRITE_STRIDE } from './DrawCommand';
export { frameRect, type SpriteSheet } from './spriteSheet';
export { mat3, type Mat3 } from './math/mat3';
export { viewToMat3, type View as ViewLike } from './math/viewToMat3';
export { tessellate, type TessellateOptions } from 'features/paths/tessellate/tessellate';
export { tessellateStroke, type StrokeOptions } from 'features/paths/tessellate/stroke';
export {
  registerFont,
  registerCanvasFont,
  isCanvasFont,
  unregisterCanvasFont,
  subscribeGlyphReady,
  registerFontOutlines,
  unregisterFontOutlines,
  hasFontOutlines,
  outlineStatus,
  listFontOutlines,
  enableLocalFontOutlines,
  canQueryLocalFonts,
} from '@weasel-js/font';
export { OUTLINE_MIN_SCREEN_PX } from './draw';
export { buildGradientRamp } from './cache/GradientRampCache';
export { IDENTITY_COLOR_MATRIX } from './state/GroupState';
export type { Mesh } from './cache/mesh';
export {
  registerProgram,
  type ShaderProgramHandle,
  type ShaderUniform,
} from './shaders/registerProgram';
export { registerTexture, type TextureHandle } from './textures/registerTexture';
export { ShaderCompileError } from './shaders/ShaderProgram';
