/**
 * @orochi235/weasel-gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 * Through step 3: WeaselRenderer + DrawCommand types for solid-fill paths,
 * groups, strokes (caps / joins / dashes / alignment), and MSDF text.
 */

export const __weaselGlPackage = true as const;

export { WeaselRenderer, type WeaselRendererOptions } from './WeaselRenderer';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  SolidPaint,
} from './DrawCommand';
export { mat3, type Mat3 } from './mat3';
export { tessellate, type TessellateOptions } from './tessellate';
export { tessellateStroke, type StrokeOptions } from './stroke';
export { registerFont } from './registerFont';
export type { Mesh } from './mesh';
