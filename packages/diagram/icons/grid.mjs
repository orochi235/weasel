// The grid every diagram glyph is drawn on. A coordinate at an odd multiple of GRID lands on a 16px
// glyph's pixel center at 1x and a pixel edge at 2x, so a 1.5 stroke there is crisp at both; a 2.5
// stroke is crisp at an even multiple.

export const GRID = 0.625;
export const at = (k) => k * GRID;
export const n = (v) => String(Math.round(v * 1e4) / 1e4);
export const P = (x, y) => `${n(x)} ${n(y)}`;
export const line = (x0, y0, x1, y1) => `M${P(x0, y0)}L${P(x1, y1)}`;
export const rect = (l, t, r, b) => `M${P(l, t)}H${n(r)}V${n(b)}H${n(l)}Z`;

/** A rectangle with circular corners of radius `rad`. */
export function roundRect(l, t, r, b, rad) {
  const a = (x, y) => `A${n(rad)} ${n(rad)} 0 0 1 ${P(x, y)}`;
  return `M${P(l + rad, t)}H${n(r - rad)}${a(r, t + rad)}V${n(b - rad)}${a(r - rad, b)}H${n(l + rad)}${a(l, b - rad)}V${n(t + rad)}${a(l + rad, t)}Z`;
}
