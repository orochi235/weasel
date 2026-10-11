import type { GlMat3 } from './glMat3';
import type { View } from './view';

/**
 * Build the world→screen transform matrix for a `View`.
 * Use as the `transform` field of a `kind: 'group'` DrawCommand to wrap
 * world-space content emitted from a layer `draw` implementation.
 *
 * Mapping: `screen = (world − {view.x, view.y}) × {view.scale.x, view.scale.y}`.
 *
 * Column-major layout (matches `mat3.identity()`):
 * `[scale.x, 0, 0,  0, scale.y, 0,  -view.x*scale.x, -view.y*scale.y, 1]`.
 */
export function viewToMat3(view: View): GlMat3 {
  const sx = view.scale.x;
  const sy = view.scale.y;
  // Add 0 to coerce -0 → 0, matching `mat3.identity()` for the {0,0,1} case.
  const tx = -view.x * sx + 0;
  const ty = -view.y * sy + 0;
  return new Float64Array([
    sx, 0, 0,
    0, sy, 0,
    tx, ty, 1,
  ]);
}
