/** Color hex8 helpers. All stored colors are `#rrggbbaa`. `<input type="color">`
 *  only round-trips the 6-char form, so call-sites pad the saved alpha back on
 *  when the user picks via the native widget. */

/** Expand `#rgb` / `#rrggbb` to `#rrggbbaa`. Pads `ff` when no alpha
 *  channel is present. Non-hex inputs (named colors, `rgba(...)`) are
 *  returned unchanged — the kit's renderer accepts arbitrary CSS, and
 *  we only normalize the hex shapes we actually persist. */
export function toHex8(color: string): string {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  if (hex.length === 3) {
    const r = hex[0], g = hex[1], b = hex[2];
    return `#${r}${r}${g}${g}${b}${b}ff`;
  }
  if (hex.length === 6) return `#${hex}ff`;
  if (hex.length === 8) return color.toLowerCase();
  return color;
}

/** Return the alpha channel of `color` as 0..1. Defaults to 1 when the
 *  color is not in 8-char hex form. */
export function getAlpha01(color: string): number {
  if (!color.startsWith('#') || color.length !== 9) return 1;
  const a = parseInt(color.slice(7, 9), 16);
  return Number.isFinite(a) ? a / 255 : 1;
}

/** Replace the alpha channel of `color` with `alpha01` (clamped to 0..1).
 *  Expands shorter hex forms first. Pass-through for non-hex inputs. */
export function withAlpha01(color: string, alpha01: number): string {
  const a = Math.max(0, Math.min(1, alpha01));
  const aa = Math.round(a * 255).toString(16).padStart(2, '0');
  const eight = toHex8(color);
  if (!eight.startsWith('#') || eight.length !== 9) return color;
  return `${eight.slice(0, 7)}${aa}`;
}

/** Merge a freshly-picked color with the previous color's alpha channel.
 *  If `picked` is already in 8-char hex form (`#rrggbbaa`, length 9), it is
 *  used as-is — its explicit alpha is preserved. Otherwise the alpha from
 *  `prev` is adopted, which handles the common case where `<input type="color">`
 *  strips the alpha channel and returns a bare 6-char hex. */
export function mergeAlphaFromPrev(picked: string, prev: string): string {
  if (picked.length === 9 && picked.startsWith('#')) return picked.toLowerCase();
  return withAlpha01(picked, getAlpha01(prev));
}
