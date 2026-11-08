/** Which way a polar space's hue goes between two endpoints, as CSS
 *  `hue-interpolation-method`: the arc of at most 180°, or the other one. */
export type HueInterpolation = 'shorter' | 'longer';

/** The hue `t` of the way from `h1` to `h2`, in degrees, along the arc `method` names, in [0, 360). Hues exactly
 *  opposite go the positive way, as CSS's `shorter` does. */
export function lerpHueDeg(h1: number, h2: number, t: number, method: HueInterpolation = 'shorter'): number {
  let dh = (((h2 - h1) % 360) + 360) % 360;
  if (method === 'shorter') {
    if (dh > 180) dh -= 360;
  } else if (dh > 0 && dh < 180) {
    dh -= 360;
  }
  return (((h1 + dh * t) % 360) + 360) % 360;
}
