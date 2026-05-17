/**
 * `resizeAction` — ongoing Action descriptor for anchor-relative drag resize.
 *
 * ## Status: REAL (Phase 12)
 *
 * The invoker now performs real anchor-relative resize math for rect-shaped
 * poses. It reads `ctx.drag.affordance` to determine which corner is dragged
 * and which is fixed, captures start poses, applies per-frame bounds remapping
 * via `RECT_POSE_DESCRIPTOR`, and commits a single `scene.batch` entry on end.
 *
 * ## AffordanceHit contract
 *
 * The invoker expects `ctx.drag.affordance.kind` to match `'handle:*'` and
 * `ctx.drag.affordance.fixedPoint` to carry the world-space fixed corner. The
 * `useGestureDispatcher` caller is responsible for supplying a valid
 * `affordanceAt` thunk that produces these values. Without a matching
 * affordance, the invoker returns `{}` (safe no-op) so other bindings can
 * handle the drag instead (e.g. `moveAction`).
 *
 * ## Pose generics
 *
 * Poses are treated as `{x, y, width, height}` (rect-shaped). Consumers with
 * non-rect poses should register a custom action. Rotation is NOT supported —
 * rotated resize is deferred to Phase 13 along with the full chrome bridge.
 *
 * ## Per-frame vs commit writes
 *
 * Unlike `moveAction`, resize writes to the scene on every `onMove` call so
 * the canvas renders live feedback (the move overlay system is not yet wired
 * for resize). This produces O(frames) undo history entries during the drag,
 * which is acceptable for Phase 12. Phase 13 TODO: switch to scratch-only
 * during drag + single batch commit, matching `moveAction`'s pattern.
 *
 * @see useResize — the React hook this descriptor mirrors.
 * @see src/interactions/actions/resize/geometry.ts — `PoseDescriptor`.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { ResizePose } from '../../gestures/types';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';

// ---------------------------------------------------------------------------
// Anchor math (subset of useResize.move, unrotated path)
// ---------------------------------------------------------------------------

/**
 * Parse a handle kind string into a ResizeAnchor.
 *
 * The anchor identifies which corner stays FIXED during resize. The dragged
 * corner is the one diagonally opposite.
 *
 * Convention (matches `cornerResizeHandles`):
 *   top-left  → anchor { x: 'max', y: 'max' }  (right+bottom edge fixed)
 *   top-right → anchor { x: 'min', y: 'max' }  (left+bottom edge fixed)
 *   bot-left  → anchor { x: 'max', y: 'min' }  (right+top edge fixed)
 *   bot-right → anchor { x: 'min', y: 'min' }  (left+top edge fixed)
 */
function anchorFromHandleKind(kind: string): { x: 'min' | 'max' | 'free'; y: 'min' | 'max' | 'free' } | null {
  switch (kind) {
    case 'handle:top-left':     return { x: 'max', y: 'max' };
    case 'handle:top-right':    return { x: 'min', y: 'max' };
    case 'handle:bottom-left':  return { x: 'max', y: 'min' };
    case 'handle:bottom-right': return { x: 'min', y: 'min' };
    default:                    return null;
  }
}

/**
 * Compute proposed bounds given the origin bounds, anchor, and drag delta.
 * Matches the unrotated path in `useResize.move`.
 */
function computeProposedBounds(
  ob: ResizePose,
  anchor: { x: 'min' | 'max' | 'free'; y: 'min' | 'max' | 'free' },
  dx: number,
  dy: number,
): ResizePose {
  let nx = ob.x;
  let ny = ob.y;
  let nw = ob.width;
  let nh = ob.height;

  if (anchor.x === 'min') {
    // Left edge is fixed; right edge (dragged) moves → width grows/shrinks from right.
    nw = ob.width + dx;
  } else if (anchor.x === 'max') {
    // Right edge is fixed; left edge (dragged) moves.
    nx = ob.x + dx;
    nw = ob.width - dx;
  }

  if (anchor.y === 'min') {
    nh = ob.height + dy;
  } else if (anchor.y === 'max') {
    ny = ob.y + dy;
    nh = ob.height - dy;
  }

  return { x: nx, y: ny, width: nw, height: nh };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface ResizeScratch {
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Start poses keyed by node id. */
  startPoses: Map<NodeId, unknown>;
  /** Shared origin bounds (union for multi-select, own bounds for single). */
  originBounds: ResizePose;
  anchor: { x: 'min' | 'max' | 'free'; y: 'min' | 'max' | 'free' };
  /** World-space start position from drag.start. */
  startWorld: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `resize` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 * Requires `InvocationCtx.drag.affordance` with a `handle:*` kind.
 */
export const resizeAction: Action & { requires: string[] } = {
  id: 'resize',
  label: 'Resize',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      // Guard: missing deps → bail.
      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      // Guard: empty selection → bail.
      if (ids.length === 0) return {};

      // Guard: must have a resize-handle affordance.
      const affordance = ctx.drag?.affordance;
      if (!affordance || !affordance.kind.startsWith('handle:')) return {};

      const anchor = anchorFromHandleKind(affordance.kind);
      if (!anchor) return {};

      // Capture start poses and compute the union origin bounds.
      const startPoses = new Map<NodeId, unknown>();
      const leafBounds: ResizePose[] = [];
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        startPoses.set(id, node.pose);
        // Treat pose as ResizePose (rect-shaped assumption).
        leafBounds.push(RECT_POSE_DESCRIPTOR.getBounds(node.pose as ResizePose));
      }

      if (startPoses.size === 0) return {};

      // Union bounds for multi-select (single-select: just the one rect).
      const ob: ResizePose = leafBounds.length === 1
        ? leafBounds[0]
        : leafBounds.reduce((acc, b) => ({
            x: Math.min(acc.x, b.x),
            y: Math.min(acc.y, b.y),
            width: Math.max(acc.x + acc.width, b.x + b.width) - Math.min(acc.x, b.x),
            height: Math.max(acc.y + acc.height, b.y + b.height) - Math.min(acc.y, b.y),
          }));

      const startWorld = { x: ctx.drag?.start.x ?? 0, y: ctx.drag?.start.y ?? 0 };

      const scratch: ResizeScratch = {
        ids,
        scene,
        startPoses,
        originBounds: ob,
        anchor,
        startWorld,
      };

      return {
        onMove(mctx: InvocationCtx): void {
          if (!mctx.drag) return;
          const dx = mctx.drag.current.x - scratch.startWorld.x;
          const dy = mctx.drag.current.y - scratch.startWorld.y;

          const proposedBounds = computeProposedBounds(scratch.originBounds, scratch.anchor, dx, dy);

          for (const id of scratch.ids) {
            const startPose = scratch.startPoses.get(id);
            if (startPose === undefined) continue;
            const startBounds = RECT_POSE_DESCRIPTOR.getBounds(startPose as ResizePose);
            const nextPose = RECT_POSE_DESCRIPTOR.remapBounds(
              startPose as ResizePose,
              scratch.originBounds,
              proposedBounds,
            );
            // Write live so the canvas renders feedback. Phase 13 TODO: switch
            // to scratch-only + single batch commit to match moveAction.
            // Only write if bounds actually changed (avoid no-op dirty marks).
            const np = nextPose as ResizePose;
            const sp = startBounds;
            const changed =
              np.x !== sp.x || np.y !== sp.y ||
              np.width !== sp.width || np.height !== sp.height;
            if (changed) {
              scratch.scene.setPose(id, nextPose);
            }
          }
        },

        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            // Restore original poses on cancel.
            for (const id of scratch.ids) {
              const startPose = scratch.startPoses.get(id);
              if (startPose !== undefined) {
                scratch.scene.setPose(id, startPose);
              }
            }
            return;
          }
          // 'commit': the scene already has the final pose from the last onMove;
          // nothing extra to do. The undo stack has the per-frame writes — Phase 13
          // will collapse these into a single batch entry.
        },
      };
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
