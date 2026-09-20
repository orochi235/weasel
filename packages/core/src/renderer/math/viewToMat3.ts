/**
 * View → GlMat3 helper for layer `draw` implementations on world-space layers.
 *
 * `View` is `@weasel-js/routing`'s, the one every viewport action is typed
 * in. A type-only import emits no runtime edge, so there is no reason for the
 * renderer to hold a second structurally-identical declaration and put it in
 * the emitted `.d.ts` anonymously.
 */

import type { View } from '@weasel-js/routing';
import type { GlMat3 } from './mat3';

export type { View };

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
  return new Float32Array([
    sx, 0, 0,
    0, sy, 0,
    tx, ty, 1,
  ]) as GlMat3;
}
