import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import type { StagedBatchState } from './batch';
import type { DrawContext } from './drawContext';
import { sameValues } from './uniforms';

/** Identity in row-major 4×5 leaves `src` untouched *and* leaves the shader's
 *  clamp with nothing to do, which is what makes the alpha fold exact. */
export function isIdentityColorMatrix(cm: Float32Array): boolean {
  return cm === IDENTITY_COLOR_MATRIX || sameValues(IDENTITY_COLOR_MATRIX, cm);
}

/** Whether solids and glyphs are mapped here at all. Mutable only so the perf
 *  specs that break a run with a color matrix still can; the barrel does not
 *  export it. Off, a matrix breaks every run it changes under, as it used to. */
export const colorFolding = { enabled: true };

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The color a solid or glyph vertex carries, from its straight-alpha rgba.
 *
 * The batch shader computes `mapped = clamp(CM * src + bias)` and
 * `a = mapped.a * u_alpha`, and for a vertex whose texel is white or a
 * distance field `src` is the vertex color alone. So in a run drawn under
 * identity the same arithmetic done here gives the same fragment, and the
 * group's matrix and alpha need not be uniforms: they cannot break the run.
 * In a run drawn under a real matrix the shader does it, and the color goes
 * in as authored.
 */
export function foldColor(
  ctx: DrawContext, staged: StagedBatchState, r: number, g: number, b: number, a: number,
): [number, number, number, number] {
  if (!staged.foldsAlpha) return [r, g, b, a];
  const cm = ctx.state.colorMatrix;
  const alpha = ctx.state.alpha;
  if (isIdentityColorMatrix(cm)) return [r, g, b, a * alpha];
  return [
    clamp01(cm[0] * r + cm[1] * g + cm[2] * b + cm[3] * a + cm[4]),
    clamp01(cm[5] * r + cm[6] * g + cm[7] * b + cm[8] * a + cm[9]),
    clamp01(cm[10] * r + cm[11] * g + cm[12] * b + cm[13] * a + cm[14]),
    clamp01(cm[15] * r + cm[16] * g + cm[17] * b + cm[18] * a + cm[19]) * alpha,
  ];
}

/** Channel scales for a textured quad; the fourth multiplies its alpha after the texel's. */
export type Tint = readonly [number, number, number, number];

const NO_TINT: Tint = [1, 1, 1, 1];
const DIAGONAL = [0, 6, 12, 18];

/**
 * The per-channel scale `cm` amounts to on a texel, or null when the CPU
 * cannot stand in for the shader.
 *
 * It can when the matrix has no bias and nothing off its diagonal, and every
 * scale is within 0..1: then `clamp(CM * texel)` clamps nothing, and scaling
 * the vertex color the texel is multiplied by gives the same product under
 * identity. A scale past 1 does not qualify, because the shader clamps after
 * the texel and a vertex color cannot.
 */
export function textureTint(cm: Float32Array): Tint | null {
  if (isIdentityColorMatrix(cm)) return NO_TINT;
  for (let i = 0; i < 20; i++) {
    const v = cm[i];
    if (DIAGONAL.includes(i) ? v < 0 || v > 1 : v !== 0) return null;
  }
  return [cm[0], cm[6], cm[12], cm[18]];
}

/** The tint a quad staged into `staged` carries: the live matrix's in a run drawn under identity. */
export function stagedTint(staged: StagedBatchState, tint: Tint | null): Tint {
  return staged.foldsAlpha && tint !== null ? tint : NO_TINT;
}
