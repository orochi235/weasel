/**
 * View → Mat3 helper for layer `draw` implementations on world-space layers.
 *
 * The kit's main package ships a `View` type at
 * `src/core/viewport/view.ts`; we re-declare a structurally compatible
 * shape here to avoid a runtime cross-package import. Exported as
 * `ViewLike` from the package barrel.
 */

import type { Mat3 } from './mat3';

/** A weasel View — `{x, y, scale: {x, y}}`. Local type to avoid a cross-package import. */
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

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
export function viewToMat3(view: View): Mat3 {
  const sx = view.scale.x;
  const sy = view.scale.y;
  // Add 0 to coerce -0 → 0, matching `mat3.identity()` for the {0,0,1} case.
  const tx = -view.x * sx + 0;
  const ty = -view.y * sy + 0;
  return new Float32Array([
    sx, 0, 0,
    0, sy, 0,
    tx, ty, 1,
  ]) as Mat3;
}
