import type { Affine } from '../affine';
import { transformCoords } from '../affine';
import { PathBuilder } from './builder';
import type { Path, PolygonPath } from '../path';
import { scaleCorners } from './cornerSpec';
import { coordsFrom, originFor } from './pathOrigin';

/** Below this, a matrix's rotation and shear terms are rounding left by
 *  composing transforms (a half turn's sine is 1.2e-16), not a slant. */
const AXIS_ALIGNED_EPSILON = 1e-9;

/** Apply an `Affine` to a path's geometry. Never mutates the input.
 *
 * Axis-aligned maps (no rotation/shear: `m[1]` and `m[2]` within 1e-9 of 0) keep a
 * `RectPath` a rect, normalizing negative extent (mirror). Rotation or
 * shear promotes the rect's four corners to a `PolygonPath`.
 *
 * A polygon that had no origin and lands past `ORIGIN_THRESHOLD` is measured
 * from the one `originFor` picks, so the map's doubles survive the float32
 * coords; `autoOrigin: false` keeps it origin-free. */
export function transformPath(path: Path, m: Affine, opts: TransformPathOptions = {}): Path {
  const [a, b, c, d, e, f] = m;
  if (path.kind === 'rect') {
    if (Math.abs(b) < AXIS_ALIGNED_EPSILON && Math.abs(c) < AXIS_ALIGNED_EPSILON) {
      // Pure scale + translate — corners remain axis-aligned.
      const x0 = a * path.x + e;
      const y0 = d * path.y + f;
      const x1 = a * (path.x + path.width) + e;
      const y1 = d * (path.y + path.height) + f;
      return {
        kind: 'rect',
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
    }
    // Rotation / shear — promote to polygon with the four rect corners.
    const poly = new PathBuilder().autoOrigin()
      .moveTo(path.x, path.y)
      .lineTo(path.x + path.width, path.y)
      .lineTo(path.x + path.width, path.y + path.height)
      .lineTo(path.x, path.y + path.height)
      .close()
      .build();
    return transformPolygon(poly, m, opts);
  }
  return transformPolygon(path, m, opts);
}

/** Options for {@link transformPath}. */
export interface TransformPathOptions {
  /** Give a far-out result with no origin one. Default true. */
  autoOrigin?: boolean;
}

function transformPolygon(path: PolygonPath, m: Affine, opts: TransformPathOptions): PolygonPath {
  // A corner radius scales as a length does: by the map's mean scale.
  const scaled = scaleCorners(path, Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])));
  const o = path.origin;
  if (o === undefined) {
    const mapped = transformCoords(path.coords, m);
    const picked = opts.autoOrigin !== false ? originFor(mapped) : undefined;
    return picked
      ? { ...scaled, coords: coordsFrom(picked, mapped), origin: picked }
      : { ...scaled, coords: Float32Array.from(mapped) };
  }
  // The translation moves the origin, in doubles; the coords take only the
  // linear part, so they stay offsets from it.
  const [a, b, c, d, e, f] = m;
  return {
    ...scaled,
    coords: Float32Array.from(transformCoords(path.coords, [a, b, c, d, 0, 0])),
    origin: { x: a * o.x + c * o.y + e, y: b * o.x + d * o.y + f },
  };
}
