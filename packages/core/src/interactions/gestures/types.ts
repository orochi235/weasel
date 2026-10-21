import type { PlaneMap } from 'core/viewport/parallax';
import type { Op } from 'core/ops/types';
import type { MoveAdapter, SnapTarget } from 'core/adapters/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import type { KitSettingsStore } from '@weasel-js/react';

import type { ModifierState } from '@weasel-js/routing';
import type { GestureFrames } from './frames';
export type { GestureFrames, ModifierState };

/** Pointer position in world coords, and in client coords when the event carried them
 *  (a keystroke, a UI-driven trigger, and a synthetic probe do not). */
export interface PointerState {
  worldX: number;
  worldY: number;
  clientX?: number;
  clientY?: number;
}

/**
 * Per-gesture context passed to behaviors. `current` is the running pose
 * map; behaviors mutate proposed poses by returning new TPose values from
 * onMove. `scratch` is per-gesture key/value storage that resets at the
 * next gesture start.
 */
export interface GestureContext<TPose, TNode extends { id: string } = { id: string }> {
  draggedIds: string[];
  origin: Map<string, TPose>;
  current: Map<string, TPose>;
  snap: SnapTarget<TPose> | null;
  modifiers: ModifierState;
  pointer: PointerState;
  /**
   * Camera of the view the input landed in (a `<CanvasView>`'s own, not the
   * surface's), current as of this frame. `null` where no view answered; a
   * screen-pixel length then reads as one world unit.
   */
  view: View | null;
  /**
   * How the camera's world maps into the world this gesture's poses are in,
   * when that is a parallax plane; absent or null otherwise. The camera draws
   * its guides and grid in its own world, so a snap strategy carries them
   * through this before comparing them with a pose.
   */
  plane?: PlaneMap | null;
  /**
   * The kit settings of the canvas the gesture runs on (its `kitSettings` dep),
   * for a behavior or snap strategy to read a reach or threshold the moment it
   * uses one. Absent or null where nothing published a store.
   */
  kitSettings?: KitSettingsStore | null;
  /**
   * Frame math over the scene the gesture edits; see {@link GestureFrames}.
   * Set by move, resize, rotate, and clone. Absent where no node is behind
   * the gesture's poses: an insert's points, a lasso's.
   */
  frames?: GestureFrames<TPose>;
  /**
   * The translation that carries one pose's bounds onto another's, measured by
   * the canvas's pose descriptor. Set by move; a behavior that knows where a
   * node should land returns it as its `transform`.
   */
  offset?: (from: TPose, to: TPose) => { dx: number; dy: number };
  adapter: MoveAdapter<TNode, TPose>;
  /**
   * Per-gesture mutable store. Keys should be namespaced by behavior name to avoid
   * collisions: `'behaviorName'` for a single value, `'behaviorName.field'` for
   * sub-keys. Two behaviors sharing a key will silently clobber each other.
   */
  scratch: Record<string, unknown>;
}

/**
 * Generalized base behavior. Each hook defines an alias that pins the
 * proposed-pose shape (TProposed) and the onMove return shape (TMoveResult).
 * onEnd runs on commit for every behavior, in order, and the first
 * non-undefined return wins (Op[] = commit those, null = abort, undefined =
 * defer); later answers are ignored. So a behavior holding state outside the
 * gesture (published guides, a timer) releases it in onEnd even when an
 * earlier behavior decides, or throws: every onEnd still runs, the first
 * error is rethrown after, and nothing commits. `end.answered` says one did
 * either: a behavior that acts on the scene itself from onEnd (starts an
 * animation, applies ops) only cleans up then. A canceled gesture (Esc, pointercancel) runs every
 * behavior's `onCancel` instead, which releases the same state. `TEnd` is
 * what `onEnd` is told; an action with more to offer than `BehaviorEnd`
 * extends it (`MoveEnd`).
 *
 * `defaultTransient`: when one behavior of a move, resize or rotate sets it
 * and the binding leaves `transient` unset, the gesture commits through
 * `scene.untracked` (no history entry). An explicit `transient` wins.
 */
export interface ActionBehavior<TPose, TProposed, TMoveResult, TEnd extends BehaviorEnd = BehaviorEnd> {
  defaultTransient?: boolean;
  onStart?(ctx: GestureContext<TPose>): void;
  onMove?(ctx: GestureContext<TPose>, proposed: TProposed): TMoveResult | void;
  onEnd?(ctx: GestureContext<TPose>, end: TEnd): Op[] | null | void;
  onCancel?(ctx: GestureContext<TPose>): void;
  /**
   * Called once per gesture, for every behavior whose `onStart` ran, after
   * the commit's ops have applied (or the cancel has run) and after the
   * gesture's preview overrides are dropped. `committed` is false when the
   * gesture was canceled, aborted by a behavior (`onEnd` returned `null`),
   * released with nothing to commit, or refused by a container its ops
   * dropped something into, and true otherwise: the action or
   * a behavior made the commit, a behavior claiming it with no ops
   * included. For move, resize, and rotate it is the value `onGestureEnd`
   * receives.
   */
  onSettled?(ctx: GestureContext<TPose>, committed: boolean): void;
}

/** What a behavior's `onEnd` is told about the commit, beside the gesture. */
export interface BehaviorEnd {
  /** An earlier behavior's `onEnd` already decided the commit, so this one's
   *  answer is ignored. */
  answered: boolean;
}

// ----- move -----

/**
 * The translation a drag proposes and its behaviors shape, applied identically
 * to every dragged id so a multi-select gesture cannot drift apart. Resize and
 * rotate behaviors answer in their own terms (`ResizeMoveResult`,
 * `RotateMoveResult`), not through this.
 */
export type GroupTransform = { kind: 'translate'; dx: number; dy: number };

/**
 * Per-frame result a `MoveBehavior.onMove` can return. `snap` announces a
 * visual snap target.
 */
export interface BehaviorResult<TPose> {
  /** Replace the proposed transform. Applied uniformly to every id. */
  transform?: GroupTransform;
  /** Preview poses for individual ids, each in its node's stored frame. For
   *  a dragged id the pose replaces the group transform this frame: a
   *  behavior that will commit its nodes where one translation cannot put
   *  them, such as a slot each — except a descendant a moving frame
   *  carries, which rides its frame whatever is posed for it. Any other id
   *  is shown there for this frame only, and committing it is the
   *  behavior's job; where a layout drop reflows the same id with no reflow
   *  transition, the layout's pose wins. A later behavior's pose for an id
   *  replaces an earlier one's. */
  poses?: ReadonlyMap<string, TPose>;
  /** Ids whose preview paints at full opacity this frame rather than as a
   *  ghost, added to those of the other behaviors. */
  opaque?: Iterable<string>;
  snap?: SnapTarget<TPose> | null;
}

/** What a move behavior's `onEnd` is told. */
export interface MoveEnd extends BehaviorEnd {
  /** The action's default translate commit for the dragged roots in `ids`
   *  and the descendants that follow them, by the drag as the behaviors
   *  shaped it. For a behavior that claims the commit but places only some of
   *  the nodes: it returns these beside its own ops. An id that is not a
   *  dragged root is ignored. */
  translateOps(ids: Iterable<string>): Op[];
  /** Where the pointer was let go, in world coordinates; without one on the
   *  release, the last move's. `ctx.pointer` always holds the last move's. */
  pointer: { x: number; y: number };
}

/** A behavior on a move — shapes the proposed transform during a drag.
 *  Behaviors receive a `GroupTransform` and return a `BehaviorResult` shaping
 *  it. */
export type MoveBehavior<TPose> = ActionBehavior<TPose, GroupTransform, BehaviorResult<TPose>, MoveEnd>;

// ----- resize -----

/** Which corner/edge of the rect stays fixed during a resize. */
import type { ResizeAnchor } from '@weasel-js/routing';
export type { ResizeAnchor };

/** Per-frame proposed resize: pose plus the anchor pinning the opposite corner. */
export interface ResizeProposed<TPose extends Bounds> {
  pose: TPose;
  anchor: ResizeAnchor;
}

/** Per-frame result a `BoundsConstraint.onMove` can return to override the proposed pose. */
export interface ResizeMoveResult<TPose extends Bounds> {
  pose?: TPose;
}

/** A bounds-frame constraint plugged into `resizeAction`.
 *  Reads/writes `{x,y,width,height}` and can override the proposed pose
 *  on each frame (e.g. lock-aspect, clamp-min-size, snap-to-grid). */
export type BoundsConstraint<TPose extends Bounds> = ActionBehavior<
  TPose,
  ResizeProposed<TPose>,
  ResizeMoveResult<TPose>
>;

/** Live overlay state for rendering the in-flight resize ghost. */
export interface ResizeOverlay<TPose> {
  id: string;
  currentPose: TPose;
  targetPose: TPose;
  anchor: ResizeAnchor;
  /** Per-leaf scaled poses when the gesture is resizing a group, keyed by
   *  the expanded leaf ids (from `expandIds`). Absent for single-leaf
   *  resizes. */
  leafPoses?: Map<string, TPose>;
}

// ----- rotate -----

export type { RotatedPose } from 'core/geometry/poseDescriptor';

/** Per-frame proposed rotation: pose plus the candidate angle in radians. */
export interface RotateProposed<TPose> {
  pose: TPose;
  /** Proposed rotation angle (radians). */
  rotation: number;
}

/** Per-frame result a `RotateBehavior.onMove` can return to override the proposed turn. */
export interface RotateMoveResult<TPose> {
  /** A pose whose rotation, read through its descriptor, the selection turns to. */
  pose?: TPose;
  /** The angle to turn to, in radians, for a behavior that changes only the
   *  angle. Wins over `pose`. */
  rotation?: number;
}

/** A behavior on a rotate. */
export type RotateBehavior<TPose> = ActionBehavior<
  TPose,
  RotateProposed<TPose>,
  RotateMoveResult<TPose>
>;

/** Live overlay state for rendering the in-flight rotation ghost. */
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
  bounds: Bounds;
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
 *  from the (possibly modified) points each frame. */
export type InsertBehavior<TPose> = ActionBehavior<
  TPose,
  InsertProposed<TPose>,
  InsertMoveResult
>;

/** Live overlay state for rendering the in-flight insert preview. */
export interface InsertOverlay<TPose> {
  start: InsertPoint;
  current: InsertPoint;
  /** Axis-aligned bounding rect derived from `start`/`current`. */
  bounds: Bounds;
  /** TPose constructed from `bounds`. */
  pose: TPose;
}

/** Live overlay state for rendering the marquee. */
export interface AreaSelectOverlay {
  start: { worldX: number; worldY: number };
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}

// ----- lasso-select -----

/** Pose carried through lasso-select gestures: the world point under the
 *  cursor at gesture start, plus the shift-key state at start. */
export interface LassoSelectPose {
  worldX: number;
  worldY: number;
  shiftHeld: boolean;
}

/** Per-frame proposed lasso state: full vertex history + shift policy. */
export interface LassoSelectProposed {
  vertices: ReadonlyArray<{ x: number; y: number }>;
  shiftHeld: boolean;
}

/** onMove for lasso-select doesn't shape ops; behaviors only need to react
 *  in onEnd. We return void from onMove. */
export type LassoSelectMoveResult = void;

/** A behavior on a lasso-select. */
export type LassoSelectBehavior = ActionBehavior<
  LassoSelectPose,
  LassoSelectProposed,
  LassoSelectMoveResult
>;

/** Live overlay state for rendering the in-progress polyline + dashed
 *  close-line. */
export interface LassoSelectOverlay {
  vertices: ReadonlyArray<{ x: number; y: number }>;
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}

// ----- clone -----

/** What a `CloneBehavior.onMove` can return: the translation to use for
 *  every copy, and a snap target to announce. */
export type CloneBehaviorResult<TPose> = Pick<BehaviorResult<TPose>, 'transform' | 'snap'>;

/**
 * A behavior on the `clone` action's binding. It is told the originals: the
 * selected roots as `draggedIds`, with `origin` and `current` holding the
 * world pose of each node a copy is placed from, before and after the drag.
 * `onMove` reshapes the translation; `onEnd` may claim the commit with ops of
 * its own, which land in place of the copies, or abort it with `null`. A move
 * behavior that only reshapes the translation, `snap(strategy)` among them,
 * is one of these.
 */
export type CloneBehavior<TPose> = ActionBehavior<TPose, GroupTransform, CloneBehaviorResult<TPose>>;
