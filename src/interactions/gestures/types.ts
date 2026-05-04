import type { Op } from '../../core/ops/types';
import type { InsertAdapter, MoveAdapter, SnapTarget } from '../../core/adapters/types';

/** Snapshot of modifier-key state at gesture dispatch. */
export interface ModifierState {
  alt: boolean;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
}

/** Pointer position in both world and client coords. */
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

/** Pluggable per-gesture snap rule; receives the proposed pose and returns a snapped pose or `null` to skip. */
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

/** Per-frame result a `MoveBehavior.onMove` can return to override pose / snap target. */
export interface BehaviorMoveResult<TPose> {
  pose?: TPose;
  snap?: SnapTarget<TPose> | null;
}

/** A behavior plugged into `useMove` — shapes the proposed pose during a drag. */
export type MoveBehavior<TPose> = GestureBehavior<TPose, TPose, BehaviorMoveResult<TPose>>;

/** Live overlay state exposed by `useMove` for rendering ghosts and snap previews. */
export interface MoveOverlay<TPose> {
  draggedIds: string[];
  poses: Map<string, TPose>;
  snapped: SnapTarget<TPose> | null;
  hideIds: string[];
  /** Sibling poses in the destination container as a layout strategy
   *  proposes them during the live drag. Empty when no layout is engaged. */
  hypotheticalChildPositions: Map<string, TPose>;
  /** Sibling poses in the source container as the source's layout strategy
   *  proposes them when the dragged child has left it. Empty when no
   *  cross-container reflow is in flight. */
  sourceReflowPositions: Map<string, TPose>;
  /** The container the drag is currently over (for highlight chrome).
   *  null when the pointer is over no layout-bearing container. */
  destContainerId: string | null;
  /** False when no layout-bearing container has accepted the pointer
   *  (pointer is over free space, or every candidate's snap returned null).
   *  When false, gesture commits a free-space `setPose` for the dragged
   *  child on release. */
  accepted: boolean;
}

// ----- resize -----

/** Which corner/edge of the rect stays fixed during a resize. */
export type ResizeAnchor = {
  x: 'min' | 'max' | 'free';
  y: 'min' | 'max' | 'free';
};

/** Minimum rect-shaped pose required by the resize machinery. */
export interface ResizePose {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Per-frame proposed resize: pose plus the anchor pinning the opposite corner. */
export interface ResizeProposed<TPose extends ResizePose> {
  pose: TPose;
  anchor: ResizeAnchor;
}

/** Per-frame result a `ResizeBehavior.onMove` can return to override the proposed pose. */
export interface ResizeMoveResult<TPose extends ResizePose> {
  pose?: TPose;
}

/** A behavior plugged into `useResize`. */
export type ResizeBehavior<TPose extends ResizePose> = GestureBehavior<
  TPose,
  ResizeProposed<TPose>,
  ResizeMoveResult<TPose>
>;

/** Live overlay state exposed by `useResize` for rendering the in-flight resize ghost. */
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

/** Per-frame proposed rotation: pose plus the candidate angle in radians. */
export interface RotateProposed<TPose> {
  pose: TPose;
  /** Proposed rotation angle (radians). */
  rotation: number;
}

/** Per-frame result a `RotateBehavior.onMove` can return to override the proposed pose. */
export interface RotateMoveResult<TPose> {
  pose?: TPose;
}

/** A behavior plugged into `useRotate`. */
export type RotateBehavior<TPose> = GestureBehavior<
  TPose,
  RotateProposed<TPose>,
  RotateMoveResult<TPose>
>;

/** Live overlay state exposed by `useRotate` for rendering the in-flight rotation ghost. */
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

/** Per-frame proposed insert: the two world points plus their derived bounds and pose. */
export interface InsertProposed<TPose> {
  start: InsertPoint;
  current: InsertPoint;
  bounds: ResizePose;
  pose: TPose;
}

/** Per-frame result an `InsertBehavior.onMove` can return to override the start/current points. */
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

/** Live overlay state exposed by `useInsert` for rendering the in-flight insert preview. */
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

/** Per-frame proposed area-select state: start point, current point, and shift policy. */
export interface AreaSelectProposed {
  start: { worldX: number; worldY: number };
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}

/** onMove for area-select doesn't shape ops; behaviors only need to react in
 *  onEnd. We return void from onMove. */
export type AreaSelectMoveResult = void;

/** A behavior plugged into `useAreaSelect`. */
export type AreaSelectBehavior = GestureBehavior<
  AreaSelectPose,
  AreaSelectProposed,
  AreaSelectMoveResult
>;

/** Live overlay state exposed by `useAreaSelect` for rendering the marquee. */
export interface AreaSelectOverlay {
  start: { worldX: number; worldY: number };
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}

// ----- clone -----

/** Pose carried through clone gestures: ids being cloned plus the pointer/offset state. */
export interface ClonePose {
  ids: string[];
  offset: { dx: number; dy: number };
  worldX: number;
  worldY: number;
}

/** Layer category a clone targets — kit-level placeholder; consumers may narrow. */
export type CloneLayer = 'structures' | 'zones' | 'plantings';

/** A behavior plugged into `useClone`; gates on modifier state and emits ops at gesture end. */
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
