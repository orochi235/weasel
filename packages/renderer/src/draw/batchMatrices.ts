import { BATCH_MATRIX_SLOTS } from '../shaders/batchFill';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { DrawContext } from './drawContext';
import { colorFolding } from './foldColor';
import { sameValues } from './uniforms';

/**
 * One color matrix and group alpha a run draws under. A vertex names its own
 * by index, so a run holds several: entry `i` is `u_colorMatrix[i]`,
 * `u_colorBias[i]`, and `u_alpha[i]`.
 */
export interface BatchMatrix {
  /** Row-major 4×5, as `GroupState` holds it. */
  colorMatrix: Float32Array;
  alpha: number;
}

/**
 * The index this matrix and alpha have in `matrices`, the next free one if
 * they are new to it, or -1 if it is full.
 *
 * By value, not by reference: a group carrying an identity color matrix still
 * goes through `composeColorMatrix`, which allocates a new array holding equal numbers.
 */
export function matrixIndex(
  matrices: readonly BatchMatrix[], colorMatrix: Float32Array, alpha: number,
): number {
  for (let i = 0; i < matrices.length; i++) {
    const m = matrices[i];
    if (m.alpha === alpha
        && (m.colorMatrix === colorMatrix || sameValues(m.colorMatrix, colorMatrix))) return i;
  }
  return matrices.length < (colorFolding.enabled ? BATCH_MATRIX_SLOTS : 1) ? matrices.length : -1;
}

const MATRICES = new Float32Array(16 * BATCH_MATRIX_SLOTS);
const BIASES = new Float32Array(4 * BATCH_MATRIX_SLOTS);
const ALPHAS = new Float32Array(BATCH_MATRIX_SLOTS);

/** What each batch program holds this frame. Keyed on the `DrawContext`, which
 *  is built per frame, so it cannot go stale against GL state. */
const UPLOADED = new WeakMap<DrawContext, WeakMap<ShaderProgram, readonly BatchMatrix[]>>();

/** Whether `held` already starts with `matrices`. Entries past a run's own are
 *  ones no vertex of it names. */
function holds(held: readonly BatchMatrix[], matrices: readonly BatchMatrix[]): boolean {
  if (held.length < matrices.length) return false;
  for (let i = 0; i < matrices.length; i++) {
    const a = held[i];
    const b = matrices[i];
    if (a.alpha !== b.alpha) return false;
    if (a.colorMatrix !== b.colorMatrix && !sameValues(a.colorMatrix, b.colorMatrix)) return false;
  }
  return true;
}

/**
 * `u_colorMatrix`, `u_colorBias`, and `u_alpha` for a run, skipped when the
 * batch program already holds them. Nothing else may write these three.
 * `prog` must declare as many entries as the run has.
 */
export function uploadBatchMatrices(
  ctx: DrawContext, prog: ShaderProgram, matrices: readonly BatchMatrix[],
): void {
  let byProgram = UPLOADED.get(ctx);
  if (!byProgram) {
    byProgram = new WeakMap();
    UPLOADED.set(ctx, byProgram);
  }
  const held = byProgram.get(prog);
  if (held !== undefined && holds(held, matrices)) return;
  const n = matrices.length;
  for (let i = 0; i < n; i++) {
    const cm = matrices[i].colorMatrix;
    // Row-major 4×5 into a column-major mat4 and its bias column.
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) MATRICES[16 * i + col * 4 + row] = cm[row * 5 + col];
      BIASES[4 * i + row] = cm[row * 5 + 4];
    }
    ALPHAS[i] = matrices[i].alpha;
  }
  const gl = ctx.gl;
  // The entries the run has, not the whole array: the rest are ones no vertex
  // of it names.
  gl.uniformMatrix4fv(prog.uniform('u_colorMatrix')!, false, MATRICES.subarray(0, 16 * n));
  gl.uniform4fv(prog.uniform('u_colorBias')!, BIASES.subarray(0, 4 * n));
  gl.uniform1fv(prog.uniform('u_alpha')!, ALPHAS.subarray(0, n));
  byProgram.set(prog, matrices.slice());
}
