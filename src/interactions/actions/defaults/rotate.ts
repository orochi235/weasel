/**
 * `rotateAction` — ongoing Action descriptor for pointer-driven rotation (Phase 11).
 *
 * ## Status: REAL (unrotated-pivot path)
 *
 * Implements the core rotation math from `useRotate` for rect-shaped poses:
 *   - `start`: captures origin poses + AABB centers; computes start pointer
 *     angle around the union center of selected nodes.
 *   - `onMove`: derives pointer angle delta from start, applies to each node's
 *     origin rotation. In union-pivot mode (multi-selection) orbits each item's
 *     center around the union center.
 *   - `onEnd('commit')`: emits a single `scene.batch('Rotate', ...)` with
 *     per-node `setPose` calls → one undo entry for the whole drag.
 *   - `onEnd('cancel')`: no scene writes (scene never mutated during drag).
 *
 * ## Constraints vs `useRotate`
 *
 * - Assumes rect-shaped poses `{ x, y, width, height, rotation? }`. Non-rect
 *   TPose consumers need a custom action with a typed `RotateGeometry`.
 * - No behavior pipeline (snap, etc.). Behaviors wait for a later phase.
 * - No overlay rendering — deferred to Phase 7 overlay surface.
 * - Shift-snap (15° quantum) is NOT wired in this phase — omitted deliberately
 *   to keep the invoker self-contained (would need to read shift from onMove ctx).
 *   TODO: thread shift from InvocationCtx.modifiers.shift into snap logic.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract `{x, y, width, height, rotation}` from an unknown pose.
 *  Defaults to 0 for missing numeric fields and `rotation`. */
function getPoseRect(pose: unknown): { x: number; y: number; width: number; height: number; rotation: number } {
  const p = pose as Record<string, unknown>;
  return {
    x: (p['x'] as number) ?? 0,
    y: (p['y'] as number) ?? 0,
    width: (p['width'] as number) ?? 0,
    height: (p['height'] as number) ?? 0,
    rotation: (p['rotation'] as number) ?? 0,
  };
}

/** Apply a rotation delta (radians) to a rect-shaped pose, optionally
 *  orbiting the item's center around a shared union center. */
function applyRotationDelta(
  pose: unknown,
  originRotation: number,
  delta: number,
  originCenter: { x: number; y: number },
  unionCenter: { x: number; y: number },
  useUnionPivot: boolean,
): unknown {
  const p = pose as Record<string, unknown>;
  const newRotation = originRotation + delta;

  if (useUnionPivot) {
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    const ox = originCenter.x - unionCenter.x;
    const oy = originCenter.y - unionCenter.y;
    const newCx = unionCenter.x + ox * cos - oy * sin;
    const newCy = unionCenter.y + ox * sin + oy * cos;
    const pr = getPoseRect(pose);
    return { ...p, x: newCx - pr.width / 2, y: newCy - pr.height / 2, rotation: newRotation };
  }

  return { ...p, rotation: newRotation };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface RotateScratch {
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Origin pose for each selected node, captured at drag start. */
  originPoses: Map<NodeId, unknown>;
  /** AABB center for each selected node (from origin pose). */
  originCenters: Map<NodeId, { x: number; y: number }>;
  /** Per-node origin rotation (radians). */
  originRotations: Map<NodeId, number>;
  /** Union center of all selected nodes — the rotation pivot. */
  unionCenter: { x: number; y: number };
  /** Pointer angle around unionCenter at drag start. */
  startPointerAngle: number;
  /** Running delta — updated each onMove, applied once at commit. */
  currentDelta: number;
  /** Use union pivot (multi-select) vs each item's own center. */
  useUnionPivot: boolean;
  /** In-flight preview poses keyed by node id. */
  previews: Map<NodeId, unknown>;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `rotate` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * Implements the unrotated-pivot rotation path from `useRotate` for rect-
 * shaped poses. Non-rect or behavior-rich consumers should register a custom
 * `rotateAction` with a typed `RotateGeometry` dep.
 *
 * @see useRotate — the React hook this descriptor mirrors for the rect case.
 */
export const rotateAction: Action & { requires: string[] } = {
  id: 'rotate',
  label: 'Rotate',
  defaultBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses, AABB centers, and union bounds.
      const originPoses = new Map<NodeId, unknown>();
      const originCenters = new Map<NodeId, { x: number; y: number }>();
      const originRotations = new Map<NodeId, number>();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        originPoses.set(id, node.pose);
        const pr = getPoseRect(node.pose);
        const cx = pr.x + pr.width / 2;
        const cy = pr.y + pr.height / 2;
        originCenters.set(id, { x: cx, y: cy });
        originRotations.set(id, pr.rotation);
        if (pr.x < minX) minX = pr.x;
        if (pr.y < minY) minY = pr.y;
        if (pr.x + pr.width > maxX) maxX = pr.x + pr.width;
        if (pr.y + pr.height > maxY) maxY = pr.y + pr.height;
      }

      if (originPoses.size === 0) return {};

      const unionCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      const startPointerAngle = Math.atan2(
        ctx.world.y - unionCenter.y,
        ctx.world.x - unionCenter.x,
      );

      const scratch: RotateScratch = {
        ids,
        scene,
        originPoses,
        originCenters,
        originRotations,
        unionCenter,
        startPointerAngle,
        currentDelta: 0,
        useUnionPivot: ids.length > 1,
        previews: new Map<NodeId, unknown>(),
      };

      const recomputePreviews = (delta: number) => {
        scratch.previews.clear();
        if (delta === 0) return;
        for (const id of scratch.ids) {
          const origin = scratch.originPoses.get(id);
          if (origin === undefined) continue;
          const originRotation = scratch.originRotations.get(id) ?? 0;
          const originCenter = scratch.originCenters.get(id) ?? { x: 0, y: 0 };
          scratch.previews.set(
            id,
            applyRotationDelta(
              origin,
              originRotation,
              delta,
              originCenter,
              scratch.unionCenter,
              scratch.useUnionPivot,
            ),
          );
        }
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          const pointerAngle = Math.atan2(
            moveCtx.world.y - scratch.unionCenter.y,
            moveCtx.world.x - scratch.unionCenter.x,
          );
          scratch.currentDelta = pointerAngle - scratch.startPointerAngle;
          recomputePreviews(scratch.currentDelta);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          // No movement — no-op.
          if (scratch.currentDelta === 0) {
            scratch.previews.clear();
            return;
          }
          scratch.scene.batch('Rotate', () => {
            for (const id of scratch.ids) {
              const next = scratch.previews.get(id);
              if (next === undefined) continue;
              scratch.scene.setPose(id, next);
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
};
