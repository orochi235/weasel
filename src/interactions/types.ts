/**
 * Back-compat barrel. Real definitions now live in `./gestures/types` and
 * `./clipboard/types` to mirror the action/gesture split. Prefer the
 * direct imports for new code.
 */

export type {
  ModifierState,
  PointerState,
  GestureContext,
  SnapStrategy,
  GestureBehavior,
  BehaviorMoveResult,
  MoveBehavior,
  MoveOverlay,
  ResizeAnchor,
  ResizePose,
  ResizeProposed,
  ResizeMoveResult,
  ResizeBehavior,
  ResizeOverlay,
  InsertProposed,
  InsertMoveResult,
  InsertBehavior,
  InsertOverlay,
  AreaSelectPose,
  AreaSelectProposed,
  AreaSelectMoveResult,
  AreaSelectBehavior,
  AreaSelectOverlay,
  ClonePose,
  CloneLayer,
  CloneBehavior,
} from './gestures/types';
export type { ClipboardSnapshot } from './clipboard/types';
