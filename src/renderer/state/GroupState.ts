import { mat3, type Mat3 } from './mat3';

/** Row-major 4×5 color matrix identity. */
export const IDENTITY_COLOR_MATRIX = new Float32Array([
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
]);

export interface GroupFrame {
  transform?: Mat3;
  alpha?: number;
  /** Row-major 4×5 color matrix (20 floats). Absent leaves the stack unchanged. */
  colorMatrix?: Float32Array | number[];
}

/**
 * Compose two 4×5 color matrices: out = outer ∘ inner (inner applied first).
 *
 *   composed(x) = M_outer * (M_inner * x + b_inner) + b_outer
 *               = (M_outer * M_inner) * x + (M_outer * b_inner + b_outer)
 *
 * Each matrix is row-major. The 4×4 portion occupies indices
 * [0..3, 5..8, 10..13, 15..18]; bias column at [4, 9, 14, 19].
 */
function compose4x5(outer: Float32Array, inner: Float32Array): Float32Array {
  const result = new Float32Array(20);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += outer[row * 5 + k] * inner[k * 5 + col];
      }
      result[row * 5 + col] = sum;
    }
    let biasSum = outer[row * 5 + 4];
    for (let k = 0; k < 4; k++) {
      biasSum += outer[row * 5 + k] * inner[k * 5 + 4];
    }
    result[row * 5 + 4] = biasSum;
  }
  return result;
}

export class GroupState {
  private transformStack: Mat3[] = [mat3.identity()];
  private alphaStack: number[] = [1];
  private colorMatrixStack: Float32Array[] = [IDENTITY_COLOR_MATRIX];

  get transform(): Mat3 {
    return this.transformStack[this.transformStack.length - 1];
  }

  get alpha(): number {
    return this.alphaStack[this.alphaStack.length - 1];
  }

  get colorMatrix(): Float32Array {
    return this.colorMatrixStack[this.colorMatrixStack.length - 1];
  }

  push(frame: GroupFrame): void {
    const current = this.transform;
    const nextTransform = frame.transform ? mat3.multiply(current, frame.transform) : current;
    const nextAlpha = frame.alpha !== undefined ? this.alpha * frame.alpha : this.alpha;
    const nextCM = frame.colorMatrix
      ? compose4x5(
          this.colorMatrix,
          frame.colorMatrix instanceof Float32Array
            ? frame.colorMatrix
            : new Float32Array(frame.colorMatrix),
        )
      : this.colorMatrix;
    this.transformStack.push(nextTransform);
    this.alphaStack.push(nextAlpha);
    this.colorMatrixStack.push(nextCM);
  }

  pop(): void {
    if (this.transformStack.length <= 1) {
      throw new Error('GroupState.pop: cannot pop root frame');
    }
    this.transformStack.pop();
    this.alphaStack.pop();
    this.colorMatrixStack.pop();
  }
}
