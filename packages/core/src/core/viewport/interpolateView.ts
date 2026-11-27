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
  const ratio = s1 / s0;
  // log1p stays exact for ratios near 1; far from 1 it would round (s1 - s0) / s0 to -1, and
  // a difference of logs stays finite where the ratio itself under- or overflows.
  const lnRatio = Math.abs(ratio - 1) < 0.5
    ? Math.log1p((s1 - s0) / s0)
    : Math.log(Math.abs(s1)) - Math.log(Math.abs(s0));
  if (lnRatio === 0) return linear;
  const lnS0 = Math.log(Math.abs(s0));
  const sign = Math.sign(s0);
  // Holding the fixed point gives x = x0 + (x1 - x0) * (1 - r^-t) / (1 - r^-1). expm1 keeps that
  // exact as r nears 1; on a zoom-out it is rewritten so that no power of r overflows.
  const fraction = lnRatio > 0
    ? (t: number) => Math.expm1(-t * lnRatio) / Math.expm1(-lnRatio)
    : (t: number) => Math.exp((1 - t) * lnRatio) * (Math.expm1(t * lnRatio) / Math.expm1(lnRatio));
  return (t) => ({
    x: lerp(x0, x1, fraction(t)),
    s: t === 0 ? s0 : t === 1 ? s1 : sign * Math.exp(lnS0 + t * lnRatio),
  });
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
