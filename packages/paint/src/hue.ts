/** Which way a polar space's hue goes between two endpoints, as CSS
 *  `hue-interpolation-method`: the arc of at most 180°, or the other one. */
export type HueInterpolation = 'shorter' | 'longer';

/** The hue `t` of the way from `h1` to `h2`, in degrees, along the arc `method` names, in [0, 360). Both hues are
 *  taken into [0, 360) first, and a half turn keeps the sign of `h2 - h1`, as CSS's fixup does: 180° to 0° passes
 *  90°. Equal hues stay put under `longer`, where CSS would go a full turn. */
export function lerpHueDeg(h1: number, h2: number, t: number, method: HueInterpolation = 'shorter'): number {
  const a = wrapDeg(h1);
  let dh = wrapDeg(h2) - a;
  if (method === 'shorter') {
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  } else if (dh > 0 && dh < 180) {
    dh -= 360;
  } else if (dh < 0 && dh > -180) {
    dh += 360;
  }
  return wrapDeg(a + dh * t);
}

/** `h` degrees in `[0, 360)`. */
export const wrapDeg = (h: number): number => ((h % 360) + 360) % 360;
