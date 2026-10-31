import type { GlMat3 } from '@weasel-js/geom';
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

/** A glyph quad as `placeGlyph` stages it: its corners in screen space, in
 *  `glyphCorners`' order, and its atlas rectangle as `u0 v0 u1 v1`. */
export interface PlacedGlyph { xy: number[]; uv: number[] }

const GROWN: number[] = new Array<number>(11).fill(0);

/**
 * The glyph quad at `at` in `quads`, placed as `glyphCorners` places it and
 * mapped through `m`, grown by `grow` screen units on every side, its atlas
 * rectangle with it. The growth is measured across each pair of opposite
 * edges, so a turned or sheared quad grows by the same distance as an
 * upright one.
 */
export function placeGlyph(
  quads: ArrayLike<number>, at: number, ox: number, oy: number, tanItalic: number, m: GlMat3,
  grow: number, out: PlacedGlyph,
): void {
  const c = out.xy;
  glyphCorners(quads, at, ox, oy, tanItalic, c);
  mapCorners(m, c);
  const uv = out.uv;
  for (let k = 0; k < 4; k++) uv[k] = quads[at + 4 + k];
  if (grow <= 0) return;
  // The parallelogram's area over each side is the distance between the sides opposite it.
  const area = Math.abs((c[2] - c[0]) * (c[7] - c[1]) - (c[3] - c[1]) * (c[6] - c[0]));
  if (area === 0) return;
  const w = quads[at + 2] - quads[at], h = quads[at + 3] - quads[at + 1];
  const gx = (grow * w * Math.hypot(c[6] - c[0], c[7] - c[1])) / area;
  const gy = (grow * h * Math.hypot(c[2] - c[0], c[3] - c[1])) / area;
  for (let k = 0; k < 11; k++) GROWN[k] = quads[at + k];
  GROWN[0] -= gx; GROWN[2] += gx; GROWN[1] -= gy; GROWN[3] += gy;
  const du = ((uv[2] - uv[0]) * gx) / w, dv = ((uv[3] - uv[1]) * gy) / h;
  uv[0] -= du; uv[2] += du; uv[1] -= dv; uv[3] += dv;
  glyphCorners(GROWN, 0, ox, oy, tanItalic, c);
  mapCorners(m, c);
}

function mapCorners(m: GlMat3, c: number[]): void {
  for (let k = 0; k < 8; k += 2) {
    const x = c[k], y = c[k + 1];
    c[k] = m[0] * x + m[3] * y + m[6];
    c[k + 1] = m[1] * x + m[4] * y + m[7];
  }
}
