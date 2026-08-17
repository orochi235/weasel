import type { Op } from 'core/ops/types';

export type ContainerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface LayoutChild<TPose> {
  id: string;
  pose: TPose;
}

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

export interface LayoutSnap<TPose> {
  pickTarget(
    targets: DropTarget<TPose>[],
    pointer: { x: number; y: number },
  ): DropTarget<TPose> | null;
}

export interface LayoutContainer {
  id: string;
  bounds: ContainerBounds;
}

export interface LayoutDragged<TPose> {
  id: string;
  /** The pose the dragged child currently has (pre-drop). */
  originPose: TPose;
  /** The pose the gesture proposes (pointer-driven, pre-snap). */
  pose: TPose;
  sourceContainerId: string | null;
}

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

  /** Optional: reject a drag before any drop-target work happens. A type-aware
   *  container (a palette that only takes swatches, say) returns `false` and
   *  the drag falls through to whatever container is under it next. When
   *  absent, every drag is considered — rejection is still possible later, by
   *  `snap.pickTarget` returning null. */
  acceptsDrop?(
    container: LayoutContainer,
    dragged: LayoutDragged<TPose>,
  ): boolean;
}
