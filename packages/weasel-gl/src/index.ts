/**
 * @orochi235/weasel-gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 * Step 1 ships: WeaselRenderer + DrawCommand types for solid-fill paths
 * and groups.
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
export type { Mesh } from './mesh';
