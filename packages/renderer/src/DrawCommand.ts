import type { Path, GlMat3 } from '@weasel-js/geom';
import type { CommandStroke, CommandFill } from '@weasel-js/paint';
import type { TextAlign, TextDirection, TextStyle } from '@weasel-js/text';
import type { ResolvedRun } from '@weasel-js/text';
import type { TextVerticalAlign } from '@weasel-js/text';
import type { ShaderProgramHandle, ShaderUniform } from './shaders/registerProgram';
import type { Effect } from './effects/types';
import type { BlendFactors, CompositeOp } from './effects/compositeOp';

/** DrawCommand variants implemented through step 6. */
export type DrawCommand =
  | PathDrawCommand
  | GroupDrawCommand
  | TextDrawCommand
  | ImageDrawCommand
  | SpritesDrawCommand
  | ShaderDrawCommand;

/** Draw a path, filled and/or stroked. The workhorse command: every shape the
 *  kit draws that is not text, an image, or a custom shader is one of these. */
export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  /** Solid, pattern, or gradient (linear/radial/conic), resolved for the
   *  renderer: `commandPaint` makes one from a node's `Paint`. */
  fill?: CommandFill;
  /** Stroke spec. Its `paint` takes what `fill` does. */
  stroke?: CommandStroke;
  /**
   * Optional flat RGBA-per-path-anchor color array (length =
   * `4 × countPathAnchors(path)`, floats in 0..1), arc-length-interpolated
   * across the mesh between consecutive anchors.
   *
   * **`fill` must also be set when using `vertexColors`.** The renderer
   * only enters the per-vertex shader path when the command has a fill
   * (the fill provides the opacity uniform). Pass any solid `fill` (e.g.
   * `{ paint: { color: '#fff' } }`) as the placeholder; the per-vertex colors
   * win in the shader.
   */
  vertexColors?: number[];
}

/** Draw a list of commands under a shared transform, opacity, color matrix
 *  and clip. Groups nest, and their effects accumulate down the stack — this
 *  is how a container node's transform reaches its descendants. */
export interface GroupDrawCommand {
  kind: 'group';
  transform?: GlMat3;
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
   *  throws if exceeded. */
  clip?: Path;
  /**
   * Full-screen passes run over this group's own pixels, in order, before it
   * is composited into its parent.
   *
   * Unlike every other field here, this does not accumulate down the group
   * stack — it is a render-target boundary. The children draw into a buffer of
   * their own, each effect reads the previous one's output, and the result is
   * composited back under this group's `transform`, `alpha`, `colorMatrix` and
   * whatever clip encloses it. So a blur here blurs this group and nothing
   * around it, which is what a CSS `filter` on the canvas cannot do.
   *
   * An empty or absent list costs nothing: no buffer is allocated until a
   * group asks for one.
   */
  effects?: readonly Effect[];
  /**
   * Draw the children into a buffer of their own and composite it once, the
   * render-target boundary `effects` makes, with no pass run over it. `alpha`
   * and `colorMatrix` then apply to the finished surface, so overlapping
   * children do not show through each other as they do when each is faded on
   * its own. Costs a device-resolution buffer and a full-screen composite.
   */
  isolate?: boolean;
  /**
   * How the group's finished surface joins what is already drawn. Default
   * `source-over`. Any other operator isolates the group, and its composite
   * covers the whole target inside the enclosing clip, so an operator that
   * scales the destination by the source's alpha (`source-in`,
   * `destination-in`, `destination-atop`, `copy`) also clears everything the
   * group left empty. Operators reading the destination's alpha need a target
   * that has one: a context created with `alpha: false` reads as opaque.
   */
  composite?: CompositeOp | BlendFactors;
  /**
   * Keep this group's pixels in a texture of its own, named by this id, and
   * composite that texture as one quad on later frames instead of drawing the
   * children again. They are drawn again when `children` is a different
   * array, or when anything else they were drawn under moves: the enclosing
   * transform, alpha, color matrix or clips, the frame's view matrix, the
   * drawing size, or a font, texture, paint kind or program the renderer serves.
   * So `children` must not be mutated once drawn, the rule a layer's cached
   * commands already follow.
   *
   * The composite matches drawing the group to within 8-bit rounding, except
   * at a pixel where an edge of the group crosses an edge drawn beneath it: the
   * surface is resolved from its samples before it meets the canvas, so the
   * two edges' coverage no longer pairs up, and such a pixel can land a few
   * levels off.
   *
   * Worth it for a group of a few hundred commands or more that holds still
   * across frames; below that, drawing it is cheaper than the composite. A
   * surface covers the device pixels the children can paint, clamped to the
   * drawing buffer — all of it under a custom shader with its own vertex
   * shader, one reading `gl_FragCoord` without `u_fragOrigin`, or `effects`
   * that do not say how far they reach — and is freed at the end of any
   * frame that does not draw its id. The renderer's `retainBudget` caps what
   * they hold together.
   *
   * A group with `effects` or `isolate` keeps the pixels its own surface
   * composites, effects run, so a still frame runs none of its passes.
   *
   * Ignored, and the group drawn as usual, inside another retained group, or
   * where it or anything in it composites with something other than
   * `source-over`, which reads pixels a retained surface does not have.
   */
  retain?: string;
  children: DrawCommand[];
}

/**
 * Text draw command. Renders one or more runs at (`x`, `y`) in screen
 * space, optionally word-wrapping at `maxWidth`. `style` carries node-level
 * defaults (`lineHeight`, anti-alias width) that don't belong on individual
 * runs.
 */
export interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  runs: ResolvedRun[];
  /** Wrap width. Absent never wraps. */
  maxWidth?: number;
  align?: TextAlign;
  /** What `start` / `end` resolve against, and the base direction of bidi
   *  reordering — see `LayoutRunsOpts.direction`. Default `style`'s. */
  direction?: TextDirection | 'auto';
  /** Spread each wrapped line across `width` — see `LayoutRunsOpts.justify`.
   *  `align` then sets only the lines it does not spread. Default `false`. */
  justify?: boolean;
  /** Box width `align` resolves within, from `x`. Default `maxWidth`; with
   *  neither, `x` is the line's left edge, midpoint or right edge. */
  width?: number;
  style: TextStyle;
  /** Box height for vertical alignment. When set with `verticalAlign`,
   *  the laid-out block shifts within `[y, y+height]`. */
  height?: number;
  /** Default 'top' — the legacy top-anchored behavior. */
  verticalAlign?: TextVerticalAlign;
}

/**
 * Image draw command — renders `image` at screen-space rect (x, y, w, h).
 * The image is stretched to fit; no tiling. Use a pattern Paint on a path
 * for tiling.
 */
export interface ImageDrawCommand {
  kind: 'image';
  /** A bitmap holding premultiplied pixels, which is what `createImageBitmap`
   *  makes unless told otherwise. One made with `premultiplyAlpha: 'none'`
   *  draws too bright wherever it is translucent: a browser uploads a bitmap
   *  as it stands, and nothing reports which kind it is. */
  image: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  /** Magnification filter. `'linear'` (default) smooths; `'nearest'` shows
   *  device pixels as hard squares — required by anything magnifying a
   *  framebuffer readback, where blur destroys the point of the readback. */
  sampling?: 'linear' | 'nearest';
  /** Sub-rectangle of `image` to draw, in bitmap pixels from the top-left.
   *  Omitted draws the whole bitmap. Not range-checked: a rect past the edge
   *  samples outside [0..1], which CLAMP_TO_EDGE smears. With
   *  `sampling: 'linear'` the filter reaches half a texel beyond `source`, so
   *  atlas frames need a gutter (see `SpriteSheet.spacing`) or `'nearest'`. */
  source?: { x: number; y: number; w: number; h: number };
  /** Mirror the sampled region within the destination rect. The quad does not
   *  move — a flipped draw covers exactly the pixels an unflipped one does. */
  flipX?: boolean;
  flipY?: boolean;
}

/** Floats per sprite in `SpritesDrawCommand.sprites`. */
export const SPRITE_STRIDE = 9;

/**
 * Draw many quads sampling one bitmap — an atlas, a sprite sheet, a wall of
 * thumbnails. The same picture as a run of `ImageDrawCommand`s the renderer
 * would coalesce anyway, handed over already packed so it never walks a
 * command object per quad. Reach for it past a few thousand sprites: at
 * 20,000 the object walk is about half the frame.
 *
 * The sprites are one run: they share a texture, a filter, and whatever group
 * transform, alpha, color matrix and clip are live. Anything varying per
 * sprite is in the array.
 */
export interface SpritesDrawCommand {
  kind: 'sprites';
  image: ImageBitmap;
  /** Magnification filter for the whole run, as `ImageDrawCommand.sampling`. */
  sampling?: 'linear' | 'nearest';
  /**
   * `SPRITE_STRIDE` floats per sprite:
   * `dx, dy, dw, dh, sx, sy, sw, sh, opacity`.
   *
   * Destination is in the group's coordinates; source is in bitmap pixels,
   * like `ImageDrawCommand.source`. A negative `sw` or `sh` mirrors that axis
   * within the source rect, which is what `flipX` / `flipY` do. A trailing
   * partial sprite is ignored.
   */
  sprites: Float32Array;
}

/**
 * Custom shader draw command. The renderer generates a quad over `bounds`
 * and dispatches the consumer's fragment shader with the kit's vertex prelude.
 *
 * `uniforms` keys must match names declared in the consumer's fragment shader.
 * The kit automatically sets `u_bounds`, `u_view`, `u_proj` and, where the
 * shader declares it, `u_fragOrigin` (see `registerProgram`) — do not
 * declare those in `uniforms`.
 *
 * `program` is the handle the module-level `registerProgram()` returned. Each
 * renderer compiles it the first time it draws one, so a layer emits this
 * command with nothing set up on the canvas or the renderer beforehand.
 */
export interface ShaderDrawCommand {
  kind: 'shader';
  program: ShaderProgramHandle;
  uniforms: Record<string, ShaderUniform>;
  /** Screen-space bounding rect in CSS pixels, which the kit's vertex shader
   *  covers and nothing outside it. */
  bounds: { x: number; y: number; w: number; h: number };
}
