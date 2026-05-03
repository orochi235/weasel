import type { Op } from '../../core/ops/types';
import type { InsertAdapter, MoveAdapter, SnapTarget } from '../../core/adapters/types';

export interface ModifierState {
  alt: boolean;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
}

export interface PointerState {
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
}

/**
 * Per-gesture context passed to behaviors. `current` is the running pose
 * map; behaviors mutate proposed poses by returning new TPose values from
 * onMove. `scratch` is per-gesture key/value storage that resets at the
 * next gesture start.
 */
export interface GestureContext<TPose, TObject extends { id: string } = { id: string }> {
  draggedIds: string[];
  origin: Map<string, TPose>;
  current: Map<string, TPose>;
  snap: SnapTarget<TPose> | null;
  modifiers: ModifierState;
  pointer: PointerState;
  adapter: MoveAdapter<TObject, TPose>;
  /**
   * Per-gesture mutable store. Keys should be namespaced by behavior name to avoid
   * collisions: `'behaviorName'` for a single value, `'behaviorName.field'` for
   * sub-keys. Two behaviors sharing a key will silently clobber each other.
   */
  scratch: Record<string, unknown>;
}

export interface SnapStrategy<TPose> {
  snap(pose: TPose, ctx: GestureContext<TPose, { id: string }>): TPose | null;
}

/**
 * Generalized base behavior. Each hook defines an alias that pins the
 * proposed-pose shape (TProposed) and the onMove return shape (TMoveResult).
 * onEnd is uniform: first non-undefined return wins (Op[] = commit those,
 * null = abort, undefined = defer).
 *
 * `defaultTransient`: when at least one behavior in a gesture sets this true
 * AND the hook's `options.transient` is not explicitly set, the gesture
 * commits its ops via `adapter.applyOps(ops)` (no history entry). When
 * `options.transient` is set explicitly, that value wins.
 */
export interface GestureBehavior<TPose, TProposed, TMoveResult> {
  defaultTransient?: boolean;
  onStart?(ctx: GestureContext<TPose>): void;
  onMove?(ctx: GestureContext<TPose>, proposed: TProposed): TMoveResult | void;
  onEnd?(ctx: GestureContext<TPose>): Op[] | null | void;
}

// ----- move -----

export interface BehaviorMoveResult<TPose> {
  pose?: TPose;
  snap?: SnapTarget<TPose> | null;
}

export type MoveBehavior<TPose> = GestureBehavior<TPose, TPose, BehaviorMoveResult<TPose>>;

export interface MoveOverlay<TPose> {
  draggedIds: string[];
  poses: Map<string, TPose>;
  snapped: SnapTarget<TPose> | null;
  hideIds: string[];
}

// ----- resize -----

export type ResizeAnchor = {
  x: 'min' | 'max' | 'free';
  y: 'min' | 'max' | 'free';
};

export interface ResizePose {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeProposed<TPose extends ResizePose> {
  pose: TPose;
  anchor: ResizeAnchor;
}

export interface ResizeMoveResult<TPose extends ResizePose> {
  pose?: TPose;
}

export type ResizeBehavior<TPose extends ResizePose> = GestureBehavior<
  TPose,
  ResizeProposed<TPose>,
  ResizeMoveResult<TPose>
>;

export interface ResizeOverlay<TPose> {
  id: string;
  currentPose: TPose;
  targetPose: TPose;
  anchor: ResizeAnchor;
  /** Per-leaf scaled poses when the gesture is resizing a virtual group.
   *  Keys are the expanded leaf ids (from `expandIds`); values are the
   *  per-leaf poses produced by scaling each leaf's origin pose against
   *  the group's origin/proposed union rects. Absent for single-leaf
   *  resizes. */
  leafPoses?: Map<string, TPose>;
}

// ----- rotate -----

/** ResizePose extended with a rotation angle (radians). Pivot is the AABB
 *  center of the unrotated `{x, y, width, height}`. */
export interface RotatedPose extends ResizePose {
  rotation: number;
}

export interface RotateProposed<TPose> {
  pose: TPose;
  /** Proposed rotation angle (radians). */
  rotation: number;
}

export interface RotateMoveResult<TPose> {
  pose?: TPose;
}

export type RotateBehavior<TPose> = GestureBehavior<
  TPose,
  RotateProposed<TPose>,
  RotateMoveResult<TPose>
>;

export interface RotateOverlay<TPose> {
  id: string;
  currentPose: TPose;
  targetPose: TPose;
  /** Origin pose at gesture start. */
  originPose: TPose;
}

// ----- insert -----

/** A single world-space point. Insert tracks two of these (start + current);
 *  bounds and pose are derived per-frame. */
export interface InsertPoint {
  x: number;
  y: number;
}

export interface InsertProposed<TPose> {
  start: InsertPoint;
  current: InsertPoint;
  bounds: ResizePose;
  pose: TPose;
}

export interface InsertMoveResult {
  /** Override the start point (e.g. snap-to-grid on the anchor). */
  start?: InsertPoint;
  /** Override the current point (e.g. snap the live edge). */
  current?: InsertPoint;
}

/** Behaviors operate over the two world points; bounds and pose are derived
 *  by the hook from the (possibly modified) points each frame. */
export type InsertBehavior<TPose> = GestureBehavior<
  TPose,
  InsertProposed<TPose>,
  InsertMoveResult
>;

export interface InsertOverlay<TPose> {
  start: InsertPoint;
  current: InsertPoint;
  /** Axis-aligned bounding rect derived from `start`/`current`. */
  bounds: ResizePose;
  /** TPose constructed from `bounds` via the hook's `posefromBounds`. */
  pose: TPose;
}

// ----- area-select -----

/** Pose carried through area-select gestures: the world point under the
 *  cursor at gesture start, plus the shift-key state at start. */
export interface AreaSelectPose {
  worldX: number;
  worldY: number;
  shiftHeld: boolean;
}

export interface AreaSelectProposed {
  start: { worldX: number; worldY: number };
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}

/** onMove for area-select doesn't shape ops; behaviors only need to react in
 *  onEnd. We return void from onMove. */
export type AreaSelectMoveResult = void;

export type AreaSelectBehavior = GestureBehavior<
  AreaSelectPose,
  AreaSelectProposed,
  AreaSelectMoveResult
>;

export interface AreaSelectOverlay {
  start: { worldX: number; worldY: number };
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}

// ----- clone -----

export interface ClonePose {
  ids: string[];
  offset: { dx: number; dy: number };
  worldX: number;
  worldY: number;
}

export type CloneLayer = 'structures' | 'zones' | 'plantings';

export interface CloneBehavior {
  id: string;
  /** Default true. */
  defaultTransient?: boolean;
  /** Decides whether this gesture should activate at start. */
  activates: (modifiers: ModifierState) => boolean;
  /** On end, returns ops to commit (or [] for no-op). */
  onEnd: (
    pose: ClonePose,
    ctx: { adapter: InsertAdapter<{ id: string }> },
  ) => Op[];
}
