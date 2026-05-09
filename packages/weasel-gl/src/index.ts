/**
 * @orochi235/weasel-gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 * Through step 4: WeaselRenderer + DrawCommand types for solid/pattern/
 * gradient-fill paths, groups, strokes, MSDF text, and images.
 */

export const __weaselGlPackage = true as const;

export { WeaselRenderer, type WeaselRendererOptions } from './WeaselRenderer';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
  SolidPaint,
} from './DrawCommand';
export { mat3, type Mat3 } from './mat3';
export { tessellate, type TessellateOptions } from './tessellate';
export { tessellateStroke, type StrokeOptions } from './stroke';
export { registerFont } from './registerFont';
export { buildGradientRamp } from './GradientRampCache';
export type { Mesh } from './mesh';
