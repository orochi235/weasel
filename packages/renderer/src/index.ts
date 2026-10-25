/**
 * Renderer barrel. WeaselRenderer + DrawCommand types for
 * solid/pattern/gradient-fill paths, groups (with optional color matrix
 * and per-vertex color), strokes, MSDF text, images, plus a
 * custom shader API (registerProgram, registerTexture, kind:'shader'), and
 * full-screen effect passes (registerEffect, blur/vignette, group `effects`).
 *
 * @packageDocumentation
 */

export {
  WeaselRenderer, type WeaselRendererOptions, type RenderTarget,
  type RenderOptions, type RenderSpan, type RenderSpanStats, type RenderStats, type RetainedStats,
  DEFAULT_RETAIN_BUDGET,
} from './WeaselRenderer';
export { releaseImageSource, type ImageMinification } from './cache/GLImageCache';
export { DEFAULT_FLATTEN_TOLERANCE_PX, type FlattenTolerance } from './draw/flattenTolerance';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  SpritesDrawCommand,
  ShaderDrawCommand,
} from './DrawCommand';
export type { CommandFill, CommandPaint, CommandStroke, CommandPaintUnits, PosedPaint, SolidPaint } from '@weasel-js/paint';
export { SPRITE_STRIDE } from './DrawCommand';
export { frameRect, type SpriteSheet } from './spriteSheet';
export { mat3, viewToMat3, type GlMat3, type View as ViewLike } from '@weasel-js/geom';
export { cullDrawCommands, type CullRect } from './cullDrawCommands';
export { commandsBounds } from './retain/contentBounds';
export { tessellate, type TessellateOptions } from '@weasel-js/geom/tessellate';
export { tessellateStroke, type StrokeOptions } from '@weasel-js/stroke';
export {
  registerFont,
  registerCanvasFont,
  isCanvasFont,
  unregisterCanvasFont,
  subscribeGlyphReady,
  cssFontFamily,
  cssFontFamilyLoading,
  registerFontOutlines,
  unregisterFontOutlines,
  hasFontOutlines,
  outlineStatus,
  loadFontOutlines,
  listFontOutlines,
  fontRegistry,
  fontOutlineRegistry,
  enableLocalFontOutlines,
  canQueryLocalFonts,
} from '@weasel-js/font';
export type { RegisterFontOptions } from '@weasel-js/font';
export { OUTLINE_MIN_SCREEN_PX } from './draw';
export { buildGradientRamp } from './cache/GradientRampAtlas';
export { IDENTITY_COLOR_MATRIX } from './state/GroupState';
export { applyColorMatrix, composeColorMatrix } from './state/colorMatrix';
export type { Mesh } from '@weasel-js/geom/tessellate';
export {
  registerProgram,
  programSourceRegistry,
  type ProgramSource,
  type ShaderProgramHandle,
  type ShaderUniform,
} from './shaders/registerProgram';
export {
  registerTexture, unregisterTexture, textureRegistry, type TextureEntry, type TextureHandle,
} from './textures/registerTexture';
export { registerEffect, effectsReach, type Effect } from './effects/types';
export { blur, vignette } from './effects/builtins';
export type { CompositeOp, BlendFactor, BlendFactors } from './effects/compositeOp';
export { isOwnComposite, leavesUncovered, readsBackdrop } from './effects/compositeOp';
export { EFFECT_VERT_SRC, EFFECT_KIT_UNIFORMS } from './effects/effectPrelude';
export { ShaderCompileError } from './shaders/ShaderProgram';
export { getProgramSource } from './shaders/registerProgram';
export type { ShaderProgram, ShaderStage, UniformArray } from './shaders/ShaderProgram';
export { boundsMissRect } from './cullDrawCommands';
export { strokeReachAt } from './paintedBounds';
export { markerDrawCommands } from './markerCommands';
export { resolveStrokeLengths, type ResolvedStrokeCommand, type StrokedPathCommand } from './strokeLengths';
export {
  registerPaintDrawKind,
  registerPaintDrawKindLoader,
  getPaintDrawKind,
  paintDrawKindRegistry,
  isPaintKindKnown,
  warmPaintKinds,
  type PaintBindContext,
  type PaintDrawKind,
  type PaintDrawKindLoader,
  type PaintProgram,
  type PaintResources,
} from './paintKinds';
export { fillInPoseFrame, fillToBoundsFrame, type FillPoseBox } from './fillInPoseFrame';
export { commandFill, commandPaint, commandStroke } from './patterns/commandPaint';
export { createTilePattern, type TilePatternOpts } from './patterns';
export { resolveFillPattern, resolvePatternSpec } from './patterns/resolveSpec';
export { textCommand, textCommandFromPose, textCommandFromRuns } from './textCommand';
export {
  bitmapSrc,
  getImageBitmap,
  imageStatus,
  isVectorImageSrc,
  releaseImage,
  setImageCacheBudget,
  retryImage,
  subscribeImageReady,
  type ImageNodeData,
  type ImageRasterSize,
  type ImageStatus,
} from './images/imageCache';
