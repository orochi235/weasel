import { BaseNode } from './baseNode';
import { checkedBounds } from './numberNode';

/** A curve y = f(x) over x in [0, 1], built by `f.curve`, held flat as `[x0, y0, x1, y1, …]`. Its row draws a
 *  `CurveField` across the panel's width. */
export class CurveNode extends BaseNode<number[]> {
  readonly kind = 'curve';

  /** Bound the curve's y. Default 0 to 1. */
  range(min: number, max: number): this {
    return this.ann(checkedBounds('range', min, max, 'curve'));
  }

  /** The increment a point's y snaps to. Default 0.01. */
  step(step: number): this {
    return this.ann({ step });
  }
}
