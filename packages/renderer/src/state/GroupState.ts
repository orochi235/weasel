import { mat3, type GlMat3 } from '@weasel-js/geom';

/** Row-major 4×5 color matrix identity. */
export const IDENTITY_COLOR_MATRIX = new Float32Array([
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
]);

export interface GroupFrame {
  transform?: GlMat3;
  alpha?: number;
  /** Row-major 4×5 color matrix (20 floats). Absent leaves the stack unchanged. */
  colorMatrix?: Float32Array | number[];
}

/**
 * Compose two row-major 4×5 color matrices: out = outer ∘ inner (inner
 * applied first). The bias column is at [4, 9, 14, 19].
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
  private transformStack: GlMat3[] = [mat3.identity()];
  private alphaStack: number[] = [1];
  private colorMatrixStack: Float32Array[] = [IDENTITY_COLOR_MATRIX];

  get transform(): GlMat3 {
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

  /**
   * Push a frame whose children paint into a surface of their own. The
   * transform still accumulates. Alpha and color do not: applying them on the
   * way in would fade the pixels an effect is about to read, then fade them
   * again on the way out.
   *
   * Returns the pair the caller must apply at composite time — what `push`
   * would have left on the stack.
   */
  pushIsolated(frame: GroupFrame): { alpha: number; colorMatrix: Float32Array } {
    this.push(frame);
    const composited = { alpha: this.alpha, colorMatrix: this.colorMatrix };
    this.pop();
    const current = this.transform;
    this.transformStack.push(frame.transform ? mat3.multiply(current, frame.transform) : current);
    this.alphaStack.push(1);
    this.colorMatrixStack.push(IDENTITY_COLOR_MATRIX);
    return composited;
  }

  /** Drop every pushed frame, leaving the root. A frame that throws part-way
   *  down the tree never pops, and the next frame would draw under leftovers. */
  reset(): void {
    this.transformStack.length = 1;
    this.alphaStack.length = 1;
    this.colorMatrixStack.length = 1;
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
