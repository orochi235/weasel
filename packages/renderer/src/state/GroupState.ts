import { mat3, type GlMat3 } from '@weasel-js/geom';
import { composeColorMatrix } from './colorMatrix';
import { NO_PICK_ID } from '../shaders/idOutput';

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
  /** The id the frame's pixels carry into an id frame. Absent inherits. */
  pickId?: number;
  /** Move what draws but not the frame a `'local'` paint is measured in: a
   *  marker head placed on its line, painted in the line's frame. */
  keepPaintFrame?: boolean;
}

export class GroupState {
  private transformStack: GlMat3[] = [mat3.identity()];
  private alphaStack: number[] = [1];
  private colorMatrixStack: Float32Array[] = [IDENTITY_COLOR_MATRIX];
  private pickIdStack: number[] = [NO_PICK_ID];
  private paintFrameStack: GlMat3[] = [this.transformStack[0]];

  get transform(): GlMat3 {
    return this.transformStack[this.transformStack.length - 1];
  }

  get alpha(): number {
    return this.alphaStack[this.alphaStack.length - 1];
  }

  get colorMatrix(): Float32Array {
    return this.colorMatrixStack[this.colorMatrixStack.length - 1];
  }

  /** The transform a `'local'` paint is measured in: `transform`, but under a
   *  frame pushed with `keepPaintFrame`. */
  get paintFrame(): GlMat3 {
    return this.paintFrameStack[this.paintFrameStack.length - 1];
  }

  /** The id what draws now carries into an id frame; 0 for none. */
  get pickId(): number {
    return this.pickIdStack[this.pickIdStack.length - 1];
  }

  push(frame: GroupFrame): void {
    const current = this.transform;
    const nextTransform = frame.transform ? mat3.multiply(current, frame.transform) : current;
    const nextAlpha = frame.alpha !== undefined ? this.alpha * frame.alpha : this.alpha;
    const nextCM = frame.colorMatrix
      ? composeColorMatrix(
          this.colorMatrix,
          frame.colorMatrix instanceof Float32Array
            ? frame.colorMatrix
            : new Float32Array(frame.colorMatrix),
          new Float32Array(20),
        )
      : this.colorMatrix;
    this.transformStack.push(nextTransform);
    this.paintFrameStack.push(frame.keepPaintFrame ? this.paintFrame : nextTransform);
    this.alphaStack.push(nextAlpha);
    this.colorMatrixStack.push(nextCM);
    this.pickIdStack.push(frame.pickId ?? this.pickId);
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
    const next = frame.transform ? mat3.multiply(current, frame.transform) : current;
    this.transformStack.push(next);
    this.paintFrameStack.push(frame.keepPaintFrame ? this.paintFrame : next);
    this.alphaStack.push(1);
    this.colorMatrixStack.push(IDENTITY_COLOR_MATRIX);
    this.pickIdStack.push(frame.pickId ?? this.pickId);
    return composited;
  }

  /** Drop every pushed frame, leaving the root. A frame that throws part-way
   *  down the tree never pops, and the next frame would draw under leftovers. */
  reset(): void {
    this.transformStack.length = 1;
    this.paintFrameStack.length = 1;
    this.alphaStack.length = 1;
    this.colorMatrixStack.length = 1;
    this.pickIdStack.length = 1;
  }

  pop(): void {
    if (this.transformStack.length <= 1) {
      throw new Error('GroupState.pop: cannot pop root frame');
    }
    this.transformStack.pop();
    this.paintFrameStack.pop();
    this.alphaStack.pop();
    this.colorMatrixStack.pop();
    this.pickIdStack.pop();
  }
}
