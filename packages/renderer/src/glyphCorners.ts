import { glyphTurn } from '@weasel-js/text';

/**
 * Write the corners of the glyph quad at `at` in `quads` (a group's
 * `quadData`), moved by `(ox, oy)`, into `out` as `x y` pairs: top left, top
 * right, bottom right, bottom left. A synthetic oblique leans them about the
 * baseline by `tanItalic`, 0 for an upright face, and the glyph's own turn then
 * rotates them about its pen.
 */
export function glyphCorners(
  quads: ArrayLike<number>, at: number, ox: number, oy: number, tanItalic: number, out: number[],
): void {
  const x0 = quads[at] + ox, y0 = quads[at + 1] + oy, x1 = quads[at + 2] + ox, y1 = quads[at + 3] + oy;
  const baselineY = quads[at + 8] + oy;
  // Above-baseline corners (lower y in screen coords) lean further right.
  const top = (baselineY - y0) * tanItalic;
  const bottom = (baselineY - y1) * tanItalic;
  out[0] = x0 + top; out[1] = y0;
  out[2] = x1 + top; out[3] = y0;
  out[4] = x1 + bottom; out[5] = y1;
  out[6] = x0 + bottom; out[7] = y1;
  const rotate = quads[at + 10];
  if (!rotate) return;
  const [cos, sin] = glyphTurn(rotate);
  const px = quads[at + 9] + ox;
  for (let k = 0; k < 8; k += 2) {
    const dx = out[k] - px, dy = out[k + 1] - baselineY;
    out[k] = px + dx * cos - dy * sin;
    out[k + 1] = baselineY + dx * sin + dy * cos;
  }
}
