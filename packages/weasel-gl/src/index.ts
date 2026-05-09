/**
 * @orochi235/weasel-gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 * Through step 2: WeaselRenderer + DrawCommand types for solid-fill paths,
 * groups, and strokes (caps / joins / dashes / alignment).
 */

export const __weaselGlPackage = true as const;

export { WeaselRenderer, type WeaselRendererOptions } from './WeaselRenderer';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  SolidPaint,
} from './DrawCommand';
export { mat3, type Mat3 } from './mat3';
export { tessellate, type TessellateOptions } from './tessellate';
export { tessellateStroke, type StrokeOptions } from './stroke';
export type { Mesh } from './mesh';
