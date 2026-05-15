import type { Path, FillStyle, Stroke, TextStyle, ResolvedRun } from '@orochi235/weasel';
import type { Mat3 } from './math/mat3';
import type { ShaderProgramHandle, ShaderUniform } from './shaders/registerProgram';

/**
 * Solid-fill paint variant (subset of the full `FillStyle` union from
 * `@orochi235/weasel`). Kept for back-compat with step-1/2 consumers and
 * because some code reads `fill.color` directly. Through step 4, fills can
 * be any `FillStyle` variant — solid, pattern, or gradient.
 */
export interface SolidPaint {
  fill?: 'solid';
  /** Hex string `#rgb` / `#rrggbb` / CSS color keyword the renderer can parse. */
  color: string;
  opacity?: number;
}

/** DrawCommand variants implemented through step 6. */
export type DrawCommand =
  | PathDrawCommand
  | GroupDrawCommand
  | TextDrawCommand
  | ImageDrawCommand
  | ShaderDrawCommand;

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  /** Any `FillStyle` variant: solid, pattern, or gradient (linear/radial/conic). */
  fill?: FillStyle;
  /** Stroke spec. Only solid `paint` supported through step 4. */
  stroke?: Stroke;
  /**
   * Optional flat RGBA-per-path-anchor color array (length =
   * `4 × countPathAnchors(path)`, floats in 0..1). The renderer
   * arc-length-interpolates these per-anchor colors across the
   * flattened/triangulated mesh between consecutive anchors using the
   * mesh's `anchorA` / `anchorB` / `anchorT` parameterization.
   *
   * **`fill` must also be set when using `vertexColors`.** The renderer
   * only enters the per-vertex shader path when the command has a fill
   * (the fill provides the opacity uniform; the vertex colors override
   * the fill's color). Pass any solid `fill` (e.g. `{ color: '#fff' }`)
   * as the placeholder; the per-vertex colors win in the shader.
   */
  vertexColors?: number[];
}

export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  /**
   * Optional 4×5 color matrix (row-major, 20 numbers) — `out = M₄ₓ₄ * in + bias`.
   * Accumulated multiplicatively down the group stack. Defaults to identity.
   */
  colorMatrix?: number[];
  /** Optional clip path. When set, the renderer rasterizes this path into
   *  the stencil buffer before drawing `children`; the children paint only
   *  where the clip covers. Nested groups with clips intersect — a child
   *  cannot escape an ancestor's clip. Max 7 nesting levels; the renderer
   *  throws if exceeded. Phase 2 of nested clipping. */
  clip?: Path;
  children: DrawCommand[];
}

/**
 * Text draw command. Renders one or more runs at (`x`, `y`) in screen
 * space, optionally word-wrapping at `maxWidth`. The renderer resolves
 * each run's `(fontFamily, fontWeight, fontStyle)` to an MSDF atlas via
 * `resolveFontVariant` and bucket-draws by atlas + color group.
 *
 * `style` carries node-level defaults (`lineHeight`, anti-alias width)
 * that don't belong on individual runs.
 */
export interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  runs: ResolvedRun[];
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  style: TextStyle;
}

/**
 * Image draw command — renders `image` at screen-space rect (x, y, w, h).
 * The image is stretched to fit; no tiling. Use a pattern FillStyle on a path
 * for tiling.
 */
export interface ImageDrawCommand {
  kind: 'image';
  image: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
}

/**
 * Custom shader draw command. The renderer generates a quad over `bounds`
 * and dispatches the consumer's fragment shader with the kit's vertex prelude.
 *
 * `uniforms` keys must match names declared in the consumer's fragment shader.
 * The kit automatically sets `u_bounds`, `u_view`, and `u_proj` — do not
 * declare those in `uniforms`.
 *
 * @experimental API may change before v2.
 */
export interface ShaderDrawCommand {
  kind: 'shader';
  program: ShaderProgramHandle;
  uniforms: Record<string, ShaderUniform>;
  /** Screen-space bounding rect in CSS pixels. */
  bounds: { x: number; y: number; w: number; h: number };
}
