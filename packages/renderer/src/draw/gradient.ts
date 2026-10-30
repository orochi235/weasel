import type { ColorSpace, Paint, PaintUnits, GradStop, TexturePaint } from '@weasel-js/paint';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { GradientUV } from '../drawBatch';
import { PAINT_MODE_PLAIN, PAINT_MODE_RADIAL, PAINT_MODE_CONIC } from '../shaders/batchFill';
import type { DrawContext } from './drawContext';
import { patternBatchPaint, type PatternBatchPaint } from './patternBatch';

/** A paint a run can express, resolved from a `Paint` by `batchPaint`. */
export type BatchPaint =
  | { kind: 'solid'; color: string; opacity?: number }
  | {
      kind: 'ramp'; stops: GradStop[]; space: ColorSpace; opacity?: number;
      /** `PAINT_MODE_PLAIN` for a linear gradient, whose ramp position a vertex
       *  carries outright; `PAINT_MODE_RADIAL` / `PAINT_MODE_CONIC` otherwise. */
      mode: number;
      uv: GradientUV;
    }
  | PatternBatchPaint;

/**
 * `fill` as something a run can carry, or `undefined` for a paint no run can
 * express — a shader, a registered paint kind — and `null` for a gradient or
 * a pattern whose space has no inverse under this transform, which draws
 * nothing.
 *
 * **All three gradients qualify, and for the same reason,** which is not that
 * their ramp position is affine in position — only a linear gradient's is. It
 * is that the *coordinate* the ramp position is computed from is affine in all
 * three, so a vertex can carry that and the rasterizer's interpolation across a
 * triangle is exact. A linear gradient's coordinate is the ramp position
 * itself, which is why it needs no paint mode; the other two carry a
 * gradient-space point and the shader takes a `length` or an `atan` of it.
 */
export function batchPaint(
  ctx: DrawContext, fill: Paint, hasVColors: boolean,
): BatchPaint | undefined | null {
  // Per-vertex colors stage through `tryStageVertexColors` instead.
  if (hasVColors) return undefined;
  const kind = fill.kind ?? 'solid';
  if (kind === 'solid') {
    const solid = fill as { color: string; opacity?: number };
    return { kind: 'solid', color: solid.color, opacity: solid.opacity };
  }
  if (kind === 'texture') return patternBatchPaint(ctx, fill as TexturePaint);
  if (kind !== 'linear-gradient' && kind !== 'radial-gradient' && kind !== 'conic-gradient') {
    return undefined;
  }
  const grad = fill as Extract<Paint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>;
  const g = gradientMap(ctx, grad.units);
  if (!g) return null;
  if (grad.kind === 'linear-gradient') return ramp(grad, PAINT_MODE_PLAIN, linearRampUV(g, grad));
  if (grad.kind === 'radial-gradient') return ramp(grad, PAINT_MODE_RADIAL, radialRampUV(g, grad));
  return ramp(grad, PAINT_MODE_CONIC, conicRampUV(g, grad));
}

function ramp(
  fill: { stops: GradStop[]; interpolate?: ColorSpace; opacity?: number },
  mode: number, uv: GradientUV,
): BatchPaint {
  return {
    kind: 'ramp', stops: fill.stops, space: fill.interpolate ?? 'rgb',
    opacity: fill.opacity, mode, uv,
  };
}

/**
 * Geometry-space → gradient-space, as the one matrix a vertex is measured
 * through.
 *
 * `gradientSpaceInverse` maps a screen position back into the gradient's space
 * and the batch's vertices arrive before the model transform, so the two
 * compose. This is the composition `gradFill`'s vertex shader does in two
 * steps, and the pair have to agree: a radial gradient goes through that one
 * and a linear one through this.
 */
function gradientMap(ctx: DrawContext, units: PaintUnits | undefined): GlMat3 | null {
  const inverse = gradientSpaceInverse(ctx, units);
  return inverse && mat3.multiply(inverse, ctx.state.transform);
}

/**
 * The gradient shader's `dot(p - from, dir) / len` folded into `u`, with `v`
 * left for the atlas row `stageRamps` fills in.
 */
function linearRampUV(
  g: GlMat3, fill: Extract<Paint, { kind: 'linear-gradient' }>,
): GradientUV {
  const dx = fill.to.x - fill.from.x;
  const dy = fill.to.y - fill.from.y;
  const len = Math.hypot(dx, dy) || 1;
  // dir is (dx, dy)/len and the divisor is len, so the pair is 1/len².
  const k = 1 / (len * len);
  return {
    ux: (g[0] * dx + g[1] * dy) * k,
    uy: (g[3] * dx + g[4] * dy) * k,
    u0: ((g[6] - fill.from.x) * dx + (g[7] - fill.from.y) * dy) * k,
    vx: 0, vy: 0, v0: 0,
  };
}

/** The gradient-space point scaled so its distance from the center *is* the
 *  ramp position, which is what makes the shader's half a `length`. */
function radialRampUV(
  g: GlMat3, fill: Extract<Paint, { kind: 'radial-gradient' }>,
): GradientUV {
  // The floor is `gradFill`'s own `max(u_gradRadius, 0.0001)`.
  const k = 1 / Math.max(fill.radius, 1e-4);
  return {
    ux: g[0] * k, uy: g[3] * k, u0: (g[6] - fill.center.x) * k,
    vx: g[1] * k, vy: g[4] * k, v0: (g[7] - fill.center.y) * k,
  };
}

/**
 * The gradient-space point about the center, turned by `-angle` so the shader's
 * half is an `atan` of it and nothing else.
 *
 * `gradFill` subtracts the angle from the arctangent instead. The two agree
 * because rotating a point turns its arctangent by the same amount, and the
 * `fract` that follows takes care of the wrap either way.
 */
function conicRampUV(
  g: GlMat3, fill: Extract<Paint, { kind: 'conic-gradient' }>,
): GradientUV {
  const cos = Math.cos(fill.angle);
  const sin = Math.sin(fill.angle);
  const dx0 = g[6] - fill.center.x;
  const dy0 = g[7] - fill.center.y;
  return {
    ux: cos * g[0] + sin * g[1],
    uy: cos * g[3] + sin * g[4],
    u0: cos * dx0 + sin * dy0,
    vx: cos * g[1] - sin * g[0],
    vy: cos * g[4] - sin * g[3],
    v0: cos * dy0 - sin * dx0,
  };
}

/**
 * What a gradient's vertices carry once its row is known.
 *
 * A linear gradient's `a_uv` is (ramp position, row) and its `a_post` is the
 * plain 1, because that is what the plain paint mode already samples. A radial
 * or conic one needs both `a_uv` channels for its coordinate, so its row goes
 * in `a_post` — which no gradient uses for alpha, its opacity riding the vertex
 * color instead.
 */
export function rampVertices(
  paint: Extract<BatchPaint, { kind: 'ramp' }>, rowV: number,
): { uv: GradientUV; post: number } {
  return paint.mode === PAINT_MODE_PLAIN
    ? { uv: { ...paint.uv, v0: rowV }, post: 1 }
    : { uv: paint.uv, post: rowV };
}

/**
 * Screen→gradient-space matrix for `u_worldInv`, which the vertex shader
 * applies to each fragment's screen position to recover the coordinates the
 * gradient's geometry is expressed in.
 *
 * `'world'` silently degrades to screen space when no view matrix reached
 * the renderer — `render(commands)` without a view is a supported call, and
 * a missing view is not worth a thrown frame. `null` when the space has no
 * inverse; a paint measured in it draws nothing.
 */
export function gradientSpaceInverse(ctx: DrawContext, units: PaintUnits | undefined): GlMat3 | null {
  if (units === 'local') return mat3.invert(ctx.state.transform);
  if (units === 'world' && ctx.viewMatrix) return mat3.invert(ctx.viewMatrix);
  return ctx.screenMatrix ? mat3.invert(ctx.screenMatrix) : mat3.identity();
}

/**
 * {@link gradientSpaceInverse} measured from `about`, a point in that space,
 * subtracted here in doubles: far from the origin a float32 paint-space point
 * is coarser than a pixel, and a shader's subtraction would be of two such
 * numbers.
 */
export function spaceInverseAbout(
  ctx: DrawContext, units: PaintUnits | undefined, about?: { readonly x: number; readonly y: number },
): GlMat3 | null {
  const inverse = gradientSpaceInverse(ctx, units);
  if (!inverse || !about || (about.x === 0 && about.y === 0)) return inverse;
  return mat3.multiply(mat3.translated(mat3.identity(), -about.x, -about.y), inverse);
}

/** The paint space `units` names → device pixels: the forward transform
 *  `gradientSpaceInverse` undoes, scaled by the target's pixel ratio. */
export function spaceToDevice(ctx: DrawContext, units: PaintUnits | undefined): GlMat3 | null {
  const inverse = gradientSpaceInverse(ctx, units);
  const toScreen = inverse && mat3.invert(inverse);
  if (!toScreen) return null;
  const ratio = ctx.deviceWidth && ctx.widthCss > 0 ? ctx.deviceWidth / ctx.widthCss : 1;
  return mat3.multiply(mat3.scaled(mat3.identity(), ratio, ratio), toScreen);
}
