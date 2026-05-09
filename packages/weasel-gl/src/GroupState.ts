import { mat3, type Mat3 } from './mat3';

export interface GroupFrame {
  transform?: Mat3;
  alpha?: number;
}

/**
 * Software stack tracking the cumulative transform and alpha while walking
 * a DrawCommand tree. Mirrors the semantics of `pushTransform` / `pushAlpha`
 * in a 2D context but lives in JS (the renderer applies the cumulative
 * values as uniforms per draw call).
 *
 * `transform` and `alpha` always reflect the *cumulative* values for the
 * current frame. `push` composes onto them; `pop` restores.
 */
export class GroupState {
  private transformStack: Mat3[] = [mat3.identity()];
  private alphaStack: number[] = [1];

  get transform(): Mat3 {
    return this.transformStack[this.transformStack.length - 1];
  }

  get alpha(): number {
    return this.alphaStack[this.alphaStack.length - 1];
  }

  push(frame: GroupFrame): void {
    const current = this.transform;
    const nextTransform = frame.transform ? mat3.multiply(current, frame.transform) : current;
    const nextAlpha = frame.alpha !== undefined ? this.alpha * frame.alpha : this.alpha;
    this.transformStack.push(nextTransform);
    this.alphaStack.push(nextAlpha);
  }

  pop(): void {
    if (this.transformStack.length <= 1) {
      throw new Error('GroupState.pop: cannot pop root frame');
    }
    this.transformStack.pop();
    this.alphaStack.pop();
  }
}
