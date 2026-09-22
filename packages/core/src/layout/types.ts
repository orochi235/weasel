import type { Op } from 'core/ops/types';
import type { Path } from 'core/geometry/path';

/** A layout container's extent in world units. */
export type ContainerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A child a layout strategy is arranging. */
export interface LayoutChild<TPose> {
  id: string;
  pose: TPose;
}

/** One place a dragged child could land. A strategy offers these as the drag
 *  moves, a `LayoutSnap` picks between them, and the chosen one decides both
 *  the preview and the committed poses. */
export interface DropTarget<TPose> {
  /** Where the dragged child lands if this target is picked. */
  pose: TPose;
  /** Reference point for distance metrics (snap algorithms). */
  origin: { x: number; y: number };
  /** Optional axis-aligned region (world units) used by region-aware snaps
   *  (e.g. `containedThenNearest`). When present, a pointer inside this rect
   *  is treated as a containment hit on this target. Strategies that emit
   *  region-shaped targets (gutters, drop-zones) should populate this.
   *  Strategies whose targets are point-like (free-form, snap-point) can omit
   *  it and rely on `origin`-distance snaps. */
  hitBounds?: { x: number; y: number; width: number; height: number };
  /** Strategy-private metadata (e.g. cell coords for tile-grid). */
  meta?: unknown;
}

/** Chooses which of a strategy's drop targets the pointer means, or `null`
 *  to reject the drop. Separate from the strategy so the same arrangement can
 *  be paired with different snapping rules. */
export interface LayoutSnap<TPose> {
  pickTarget(
    targets: DropTarget<TPose>[],
    pointer: { x: number; y: number },
  ): DropTarget<TPose> | null;
}

/** A container's drop region, in its local frame: the origin is the top-left
 *  of the container's world bounds. A path (a `RectPath` for a plain rect) is
 *  filled-region tested; a predicate is handed the local point. */
export type DropRegion = Path | ((point: { x: number; y: number }) => boolean);

/**
 * Which layout container a drag lands in when more than one contains the
 * point being dropped.
 *
 * - `'innermost'` (default) — the deepest container in the tree, whatever is
 *   painted over it; ties at one depth go to the one painted later.
 * - `'topmost'` — the container painted last, in the scene's render order
 *   across the whole tree, so a shallow container drawn over a deep one wins.
 * - `'region'` — only containers whose strategy declares a `dropRegion`, and
 *   only when the point is inside it; ties are broken as for `'innermost'`.
 */
export type LayoutDropTargetMode = 'innermost' | 'topmost' | 'region';

/** The container a layout strategy is arranging children within. */
export interface LayoutContainer {
  id: string;
  bounds: ContainerBounds;
}

/** The child currently being dragged: where it started, where the pointer
 *  currently proposes it goes, and which container it came from. */
export interface LayoutDragged<TPose> {
  id: string;
  /** The pose the dragged child currently has (pre-drop). */
  originPose: TPose;
  /** The pose the gesture proposes (pointer-driven, pre-snap). */
  pose: TPose;
  sourceContainerId: string | null;
}

/**
 * How a container arranges its children, and what happens when one is dragged
 * into or around it.
 *
 * The four required methods cover the whole cycle: `childPoses` is the resting
 * arrangement, `getDropTargets` enumerates where a drag could land,
 * `reflowPoses` is the live preview once a target is picked, and `commitDrop`
 * turns the result into ops so the drop is undoable.
 */
export interface LayoutStrategy<TPose> {
  childPoses(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
  ): Map<string, TPose>;

  getDropTargets(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
  ): DropTarget<TPose>[];

  reflowPoses(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
    target: DropTarget<TPose> | null,
  ): Map<string, TPose>;

  commitDrop(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
    target: DropTarget<TPose> | null,
  ): Op[];

  snap: LayoutSnap<TPose>;

  /** Optional: predicate for whether a world-space point is inside this
   *  container. When absent, callers fall back to an axis-aligned bounding-box
   *  test on the container's pose. Strategies whose containers aren't
   *  rectangular (circles, irregular zones) implement this to override the
   *  AABB default. */
  contains?(containerPose: TPose, point: { x: number; y: number }): boolean;

  /** Optional: where this container takes drops. When it returns a region,
   *  the region replaces the container body (and `contains`) as the hit area
   *  for choosing a drop container — it may be smaller than the body or reach
   *  past it — and it is what makes the container a candidate at all under
   *  `LayoutDropTargetMode` `'region'`. `null` or absent keeps the body. */
  dropRegion?(container: LayoutContainer): DropRegion | null;

  /** Optional: reject a drag before any drop-target work happens. A type-aware
   *  container (a palette that only takes swatches, say) returns `false` and
   *  the drag falls through to whatever container is under it next. When
   *  absent, every drag is considered — rejection is still possible later, by
   *  `snap.pickTarget` returning null. */
  acceptsDrop?(
    container: LayoutContainer,
    dragged: LayoutDragged<TPose>,
  ): boolean;

  /** Optional: what this container does about a child of its own that was
   *  released outside every layout container. Returning ops replaces the
   *  free-space commit — put the child back in its slot, reflow the gap
   *  closed — and an empty array leaves the container unchanged, which snaps
   *  the child home because the drag only ever wrote previews. `null` lets
   *  the drop stand where the pointer left it, which is also what a strategy
   *  without this method gets. The drag preview follows the pointer either
   *  way; this decides the release. */
  releaseDrop?(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
  ): Op[] | null;
}
