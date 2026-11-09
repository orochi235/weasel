import type { Bounds } from 'tools/builtin/select';
import type { WorldPoint } from '@weasel-js/routing';
import type { RegionPickView } from 'core/adapters/types';

/** `<SceneCanvas geometry>`: hit-test and bounds overrides, consumed by the
 *  internal select tool. Ignored if the consumer passes their own `tools`. */
export interface SceneCanvasGeometry {
  /** Hit-test override. Return the topmost id, the full back-to-front hit
   *  stack (`string[]`), or `null` for empty space. The stack form lets a
   *  consumer with domain overlap ordering (e.g. children over their
   *  container) feed the kit's `pickTopMostHit` the true order instead of
   *  pre-collapsing to one id. Matches `Canvas`'s `pickEvery` shape.
   *  `view` is the view the pick is asked for, when it is not the surface's
   *  own: a 3D host casts the ray from that view's camera. */
  pickEvery?: (world: WorldPoint, view?: RegionPickView) => string | string[] | null;
  boundsOf?: (id: string) => Bounds | null;
  /**
   * What "the pointer is on this node" means for the default body-pick.
   *
   * - `'pose'` — the node's pose rect, rotation honored.
   * - `'shape'` (default) — the pose rect as a pre-filter, then the ink the painter
   *   actually lays down: its silhouette filled or not per the painter's `ink`, plus
   *   its outline widened by the stroke half-width and `pickTolerancePx`.
   *
   * - `'pixels'` — what the canvas last painted, read from its id frames
   *   (`CanvasExtensionApi.readIdsSync`): a custom shader, an effect, or a texture's
   *   transparent parts pick as they look, not as their outline. Nodes covered by
   *   others are still found, so an action excluding the ones it drags sees what
   *   is beneath them. Each pick draws the frame again, culled to a few pixels,
   *   once per layer of the stack under the point, and hover picks on every
   *   pointer move. It falls back to `'shape'` before the first paint, on a
   *   canvas painting with WebGPU or none, and for a pick asked for a view other
   *   than the surface's own.
   *
   * Painters with no silhouette keep the pose-rect answer under `'shape'`. Ignored
   * when `pickEvery` is supplied: that override owns the test.
   */
  picking?: 'pose' | 'shape' | 'pixels';
  /**
   * Grab slop around a shape's outline, in **screen** pixels, so the target keeps
   * its apparent size at any zoom. Default 4. It widens the outline test under
   * `picking: 'shape'` and grows the pose-rect pre-filter so those outline hits
   * survive it; under `'pixels'` a node painted within this many pixels of the
   * point, along each axis, is hit. Set `0` for exact geometry.
   */
  pickTolerancePx?: number;
  /**
   * Whether a shape's box includes its stroke as drawn — align, joins, and
   * markers counted — or is the pose's geometry alone. Default `true`. The
   * selection outline and handles sit on it, resize keeps the stroke's
   * outer edge under the pointer without scaling the stroke, and rotate,
   * flip, align, and distribute measure it. Stored geometry is unaffected.
   */
  boundsIncludeStroke?: boolean;
}
