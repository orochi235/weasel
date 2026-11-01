/** What the region selects and point picks ask of the canvas. */
import type { NodeId } from 'core/scene/types';
import type { RegionPickView } from 'core/adapters/types';
import type { WorldPoint } from '@weasel-js/routing';

/** The part of the asking view a region hit-test consults. `get` is its
 *  camera, which a parallax layer is picked through. */
export type HitTestView = RegionPickView;

/**
 * Topmost-node-at-world-point dep, for any action that needs a single-best
 * pick. The dep walks hits front-to-back and returns the first id not in
 * `exclude`. Pass moving-node roots + their descendants when the caller
 * wants to ignore the nodes it's manipulating.
 */
export type NodeAtPointDep = (
  point: WorldPoint,
  exclude?: Iterable<NodeId>,
) => NodeId | null;

/** What an area-selecting action needs: a way to ask what a region covers,
 *  and a way to read and replace the selection. */
export interface AreaSelectDep {
  /** Return ids of all scene nodes whose AABB overlaps `bounds`, skipping any
   *  on a layer `view` — the view the gesture ran in — does not paint. */
  hitTestArea(
    bounds: { x: number; y: number; width: number; height: number },
    view?: HitTestView,
  ): NodeId[];
  /** The node selecting `id` selects: the outermost group above it that is
   *  not entered, as a click picks. Absent means `id` itself. */
  targetOf?(id: string): string;
  /** Return the current selection id list. */
  getSelection(): NodeId[];
  /** Replace the current selection. */
  setSelection(ids: NodeId[]): void;
}

/**
 * Adapter dep for `lassoSelectAction`: polygon-lasso hit-testing +
 * selection read/write.
 */
export interface LassoSelectDep {
  /**
   * Hit-test against a closed polygon (vertex order CW or CCW; last→first
   * closing edge is implicit). Returns matching node ids.
   * Optional — when absent, `lassoSelectAction` falls back to AABB via
   * `hitTestArea`.
   */
  hitTestLasso?(
    polygon: ReadonlyArray<WorldPoint>,
    mode: 'centers' | 'intersect' | 'enclosed',
    view?: HitTestView,
  ): string[];
  /** Return ids of nodes whose AABB overlaps the given rect (fallback). */
  hitTestArea(
    bounds: { x: number; y: number; width: number; height: number },
    view?: HitTestView,
  ): string[];
  /** The node selecting `id` selects: the outermost group above it that is
   *  not entered, as a click picks. Absent means `id` itself. */
  targetOf?(id: string): string;
  /** Return the current selection id list. */
  getSelection(): string[];
  /** Replace the current selection. */
  setSelection(ids: string[]): void;
}
