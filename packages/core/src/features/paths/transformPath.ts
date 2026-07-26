import { type Mat3, transformCoords } from '@weasel-js/geom';
import { PathBuilder } from './builder';
import { type Path, type PolygonPath } from './types';

/** Apply an affine `Mat3` to a path's geometry.
 *
 * Axis-aligned maps (no rotation/shear, i.e. `m[1] === 0 && m[2] === 0`) keep a
 * `RectPath` a rect — the four corners stay axis-aligned, so we transform the
 * two diagonal corners and normalize negative extent (mirror). Rotation or
 * shear promotes the rect's four corners to a `PolygonPath`. Polygon paths map
 * every coord via the kernel's `transformCoords`, preserving the command stream
 * and `fillRule`. Never mutates the input.
 *
 * `Mat3` here is the 6-tuple `number[]` from `@weasel-js/geom` (DOMMatrix order:
 * `[a, b, c, d, e, f]` where `x' = a·x + c·y + e`, `y' = b·x + d·y + f`),
 * not the renderer's 9-element `Float32Array`. */
export function transformPath(path: Path, m: Mat3): Path {
  const [a, b, c, d, e, f] = m;
  if (path.kind === 'rect') {
    if (b === 0 && c === 0) {
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
    const poly = new PathBuilder()
      .moveTo(path.x, path.y)
      .lineTo(path.x + path.width, path.y)
      .lineTo(path.x + path.width, path.y + path.height)
      .lineTo(path.x, path.y + path.height)
      .close()
      .build();
    return transformPolygon(poly, m);
  }
  return transformPolygon(path, m);
}

function transformPolygon(path: PolygonPath, m: Mat3): PolygonPath {
  // transformCoords returns Float64Array; PolygonPath.coords is Float32Array.
  const mapped = transformCoords(path.coords, m);
  return { ...path, coords: Float32Array.from(mapped) };
}
