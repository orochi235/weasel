/**
 * @orochi235/weasel-gl — public barrel.
 *
 * Experimental. Through step 6: WeaselRenderer + DrawCommand types for
 * solid/pattern/gradient-fill paths, groups (with optional color matrix
 * and per-vertex color), strokes, MSDF text, images, plus an experimental
 * custom shader API (registerProgram, registerTexture, kind:'shader').
 */

export const __weaselGlPackage = true as const;

export { WeaselRenderer, type WeaselRendererOptions } from './WeaselRenderer';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  ShaderDrawCommand,
  SolidPaint,
} from './DrawCommand';
export { mat3, type Mat3 } from './mat3';
export { tessellate, type TessellateOptions } from './tessellate';
export { tessellateStroke, type StrokeOptions } from './stroke';
export { registerFont } from './registerFont';
export { buildGradientRamp } from './GradientRampCache';
export { IDENTITY_COLOR_MATRIX } from './GroupState';
export type { Mesh } from './mesh';
export {
  registerProgram,
  type ShaderProgramHandle,
  type ShaderUniform,
} from './registerProgram';
export { registerTexture, type TextureHandle } from './registerTexture';
export { ShaderCompileError } from './ShaderProgram';
