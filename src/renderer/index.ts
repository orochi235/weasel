/**
 * Renderer barrel. WeaselRenderer + DrawCommand types for
 * solid/pattern/gradient-fill paths, groups (with optional color matrix
 * and per-vertex color), strokes, MSDF text, images, plus an experimental
 * custom shader API (registerProgram, registerTexture, kind:'shader').
 */

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
export { mat3, type Mat3 } from './math/mat3';
export { viewToMat3, type View as ViewLike } from './math/viewToMat3';
export { tessellate, type TessellateOptions } from '../features/paths/tessellate/tessellate';
export { tessellateStroke, type StrokeOptions } from '../features/paths/tessellate/stroke';
export { registerFont } from '../features/text/atlas/registerFont';
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
