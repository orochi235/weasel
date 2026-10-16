/**
 * Puppet deformation: pins placed on a shape and dragged, with everything
 * between them moved as rigidly as the pins allow.
 *
 * This is the rigid moving-least-squares deformation (Schaefer, McPhail and
 * Warren, 2006), not as-rigid-as-possible over a triangulation. Each point
 * takes the rotation and translation that best carry the pins to where they
 * were dragged, weighting near pins over far ones. It needs no mesh and no
 * solve, it is defined for every point in the plane — so a warped path can be
 * resampled at any density — and it cannot fly apart: a point's image is always
 * a rigid motion of it, so far from every pin the shape moves as one piece.
 * What it gives up is the shape's own outline: weights fall off with
 * straight-line distance, so two limbs that nearly touch move together.
 */
import type { Point } from '../paths/cubicMath';

/** A pin: where it was placed on the unwarped shape, and where it is now. */
export interface PuppetPin {
  from: Point;
  to: Point;
}

/**
 * The rigid moving-least-squares map carrying each pin's `from` to its `to`.
 * `falloff` is the power distance is weighted by (`1 / d^(2·falloff)`); higher
 * keeps each pin's pull more local. No pins is the identity, and one pin
 * moves the whole shape with it.
 */
export function rigidPuppetMap(pins: readonly PuppetPin[], falloff = 1): (p: Point) => Point {
  if (pins.length === 0) return (p) => ({ x: p.x, y: p.y });
  return (p) => {
    let sw = 0;
    let px = 0, py = 0, qx = 0, qy = 0;
    const w: number[] = [];
    for (const pin of pins) {
      const d2 = (pin.from.x - p.x) ** 2 + (pin.from.y - p.y) ** 2;
      if (d2 < 1e-18) return { x: pin.to.x, y: pin.to.y };
      const wi = 1 / d2 ** falloff;
      w.push(wi);
      sw += wi;
      px += wi * pin.from.x; py += wi * pin.from.y;
      qx += wi * pin.to.x; qy += wi * pin.to.y;
    }
    px /= sw; py /= sw; qx /= sw; qy /= sw;
    // The weighted best rotation taking the centered pins onto their targets.
    let dot = 0, cross = 0;
    pins.forEach((pin, i) => {
      const ax = pin.from.x - px, ay = pin.from.y - py;
      const bx = pin.to.x - qx, by = pin.to.y - qy;
      dot += w[i] * (ax * bx + ay * by);
      cross += w[i] * (ax * by - ay * bx);
    });
    const len = Math.hypot(dot, cross);
    const cos = len === 0 ? 1 : dot / len;
    const sin = len === 0 ? 0 : cross / len;
    const dx = p.x - px, dy = p.y - py;
    return { x: cos * dx - sin * dy + qx, y: sin * dx + cos * dy + qy };
  };
}

/**
 * The point `map` sends to `target`, found by stepping from `guess` by the
 * miss until it is within `tolerance` — for a map that stays close to rigid,
 * as a puppet's does, a few steps suffice. Returns the best point found.
 */
export function unwarpPoint(
  map: (p: Point) => Point,
  target: Point,
  guess: Point = target,
  tolerance = 1e-3,
): Point {
  let p = { x: guess.x, y: guess.y };
  for (let k = 0; k < 50; k++) {
    const at = map(p);
    const ex = target.x - at.x, ey = target.y - at.y;
    if (Math.hypot(ex, ey) <= tolerance) break;
    p = { x: p.x + ex, y: p.y + ey };
  }
  return p;
}
