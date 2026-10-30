import { applyColorMatrix } from '../state/colorMatrix';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import type { DrawContext } from './drawContext';
import { sameValues } from './uniforms';

/** Identity in row-major 4×5 leaves `src` untouched *and* leaves the shader's
 *  clamp with nothing to do, which is what makes the alpha fold exact. */
function isIdentityColorMatrix(cm: Float32Array): boolean {
  return cm === IDENTITY_COLOR_MATRIX || sameValues(IDENTITY_COLOR_MATRIX, cm);
}

/** Whether colors are mapped here at all, and whether a run holds more than one
 *  matrix. Mutable only so the perf specs that break a run with a color matrix
 *  still can; the barrel does not export it. Off, a matrix breaks every run it
 *  changes under, as it used to. */
export const colorFolding = { enabled: true };

/**
 * Whether a solid or a glyph under the live group state is mapped on the CPU,
 * and so staged under an identity matrix. `foldColor` and the run's choice of
 * matrix both ask here, because they have to agree.
 */
export function foldsColor(ctx: DrawContext): boolean {
  return colorFolding.enabled || isIdentityColorMatrix(ctx.state.colorMatrix);
}

/**
 * The color a solid or glyph vertex carries, from its straight-alpha rgba.
 *
 * The batch shader computes `mapped = clamp(CM * src + bias)` and
 * `a = mapped.a * u_alpha`, and for a vertex whose texel is white or a
 * distance field `src` is the vertex color alone. So the same arithmetic done
 * here gives the same fragment under an identity matrix, and the group's
 * matrix and alpha need not reach the shader. With folding off and a real
 * matrix live the shader does it, and the color goes in as authored.
 */
export function foldColor(
  ctx: DrawContext, r: number, g: number, b: number, a: number,
): [number, number, number, number] {
  const cm = ctx.state.colorMatrix;
  const alpha = ctx.state.alpha;
  if (isIdentityColorMatrix(cm)) return [r, g, b, a * alpha];
  if (!colorFolding.enabled) return [r, g, b, a];
  const out = applyColorMatrix(cm, r, g, b, a);
  out[3] *= alpha;
  return out;
}

/** {@link foldColor}, written into `out` where no matrix maps it, the case
 *  every frame of plain text takes, rather than into a new array. */
export function foldColorInto(
  ctx: DrawContext, r: number, g: number, b: number, a: number, out: [number, number, number, number],
): readonly [number, number, number, number] {
  if (!isIdentityColorMatrix(ctx.state.colorMatrix)) return foldColor(ctx, r, g, b, a);
  out[0] = r; out[1] = g; out[2] = b; out[3] = a * ctx.state.alpha;
  return out;
}

/** Channel scales for a textured vertex; the fourth multiplies its alpha after the texel's. */
export type Tint = readonly [number, number, number, number];

const NO_TINT: Tint = [1, 1, 1, 1];
const DIAGONAL = [0, 6, 12, 18];

/**
 * The per-channel scale the live group state amounts to on a texel, group
 * alpha included, or null when the CPU cannot stand in for the shader.
 *
 * It can when the matrix has no bias and nothing off its diagonal, and every
 * scale is within 0..1: then `clamp(CM * texel)` clamps nothing, and scaling
 * the vertex color the texel is multiplied by gives the same product under
 * identity. A scale past 1 does not qualify, because the shader clamps after
 * the texel and a vertex color cannot.
 */
export function textureTint(ctx: DrawContext): Tint | null {
  const cm = ctx.state.colorMatrix;
  const alpha = ctx.state.alpha;
  if (isIdentityColorMatrix(cm)) return alpha === 1 ? NO_TINT : [1, 1, 1, alpha];
  if (!colorFolding.enabled) return null;
  for (let i = 0; i < 20; i++) {
    const v = cm[i];
    if (DIAGONAL.includes(i) ? v < 0 || v > 1 : v !== 0) return null;
  }
  return [cm[0], cm[6], cm[12], cm[18] * alpha];
}

/**
 * What a textured vertex is staged under: the matrix and alpha its run draws
 * it by, the tint its vertices carry, and, once a stage call has filled it in,
 * the slot they name.
 */
export interface Textured {
  colorMatrix: Float32Array;
  alpha: number;
  /** The fourth channel carries group alpha wherever the entry's does not. */
  tint: Tint;
  /** Texture slot and matrix index together; `packSlot` adds the paint mode. */
  slot: number;
}

/**
 * A texel's color is not known until it is sampled, so the group's matrix
 * reaches it one of two ways. One that only scales channels down becomes a
 * tint on the vertices, in a run entry at identity. Any other stays a matrix
 * for the shader, as an entry of its own.
 *
 * `alphaInEntry` says where group alpha goes in that second case: into the
 * entry for a gradient, whose `a_post` may be its atlas row, and into the
 * tint's fourth channel for a quad, which multiplies its `a_post` by it.
 */
export function texturedUnder(ctx: DrawContext, alphaInEntry: boolean): Textured {
  const tint = textureTint(ctx);
  if (tint !== null) return { colorMatrix: IDENTITY_COLOR_MATRIX, alpha: 1, tint, slot: 0 };
  const colorMatrix = ctx.state.colorMatrix;
  const alpha = ctx.state.alpha;
  return alphaInEntry
    ? { colorMatrix, alpha, tint: NO_TINT, slot: 0 }
    : { colorMatrix, alpha: 1, tint: [1, 1, 1, alpha], slot: 0 };
}
