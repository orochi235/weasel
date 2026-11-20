import type { View } from './view';
import { lerp } from '@weasel-js/geom';

/**
 * Per-axis camera curve. Two views that differ in scale agree at exactly one
 * screen point; holding the world point under it fixed is what makes a zoom
 * read as anchored rather than drifting. Scale moves geometrically between
 * endpoints of one sign (a flipped, y-up axis is negative at both), so each
 * frame changes the view by the same ratio and an easing that overshoots past
 * 1 still cannot cross zero.
 *
 * Endpoints of different signs, or a zero one, get the linear branch: there is
 * no geometric path across a sign change.
 */
function axisCurve(x0: number, s0: number, x1: number, s1: number): (t: number) => { x: number; s: number } {
  const linear = (t: number) => ({ x: lerp(x0, x1, t), s: lerp(s0, s1, t) });
  if (!(s0 * s1 > 0)) return linear;
  // Equal scales: no fixed point exists on this axis. That is a pure pan.
  if (Math.abs(s1 - s0) <= 1e-12 * Math.max(Math.abs(s0), Math.abs(s1), 1)) return linear;
  const p = (x1 - x0) / (1 / s0 - 1 / s1); // screen px where the two views agree
  const w = p / s0 + x0;                   // the world point under it
  const ratio = s1 / s0;
  return (t) => {
    const s = s0 * Math.pow(ratio, t);
    return { x: w - p / s, s };
  };
}

/**
 * `InterpolatorFactory<View>` for camera animation — built once per animation,
 * called with eased `t` each frame. Pass to `Animator.tween`'s `interpolator`.
 */
export function interpolateView(from: View, to: View): (t: number) => View {
  const fx = axisCurve(from.x, from.scale.x, to.x, to.scale.x);
  const fy = axisCurve(from.y, from.scale.y, to.y, to.scale.y);
  return (t: number): View => {
    const a = fx(t);
    const b = fy(t);
    return { x: a.x, y: b.x, scale: { x: a.s, y: b.s } };
  };
}
