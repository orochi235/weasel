/**
 * `rotateAction` — ongoing Action descriptor for pointer-driven rotation.
 *
 * ## Status: REAL (unrotated-pivot path)
 *
 * Implements the core rotation math from `useRotate`:
 *   - `start`: captures origin poses + AABB centers; computes start pointer
 *     angle around the union center of selected nodes.
 *   - `onMove`: derives pointer angle delta from start, applies to each node's
 *     origin rotation. In union-pivot mode (multi-selection) orbits each item's
 *     center around the union center.
 *   - `onEnd('commit')`: builds one `createTransformOp` per node (from =
 *     pre-mutation origin pose, to = rotated pose) and commits them as a
 *     single batch → one undo entry for the whole drag. Routes through the
 *     optional `applyOps` dep (consumer history) when present, else
 *     `scene.applyBatch` + `defaultCommitAdapter`.
 *   - `onEnd('cancel')`: no scene writes (scene never mutated during drag).
 *
 * ## Constraints vs `useRotate`
 *
 * - Reads and writes poses through the `poseDescriptor` dep; a pose whose
 *   descriptor has no `withRotation`, or reports `supportsRotation` false, is
 *   left alone.
 * - No behavior pipeline (snap, etc.). Behaviors wait for a later phase.
 * - No overlay rendering — deferred to Phase 7 overlay surface.
 * - Shift-snap (15° quantum) is NOT wired in this phase — omitted deliberately
 *   to keep the invoker self-contained (would need to read shift from onMove ctx).
 *   TODO: thread shift from InvocationCtx.modifiers.shift into snap logic.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import { syncPreviewOverrides, dropPreviewOverrides } from '../previewOverrides';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import type { SelectionApi } from 'core/selection/useSelection';
import { unionAABB } from 'core/geometry/unionBounds';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { poseDescriptorOf } from '../poseDescriptorDep';
import {
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
  type PoseDescriptor,
} from '../resize/geometry';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Apply a rotation delta (radians) to a pose, optionally orbiting the item's
 *  center around a shared union center. */
function applyRotationDelta(
  d: PoseDescriptor<unknown>,
  pose: unknown,
  originRotation: number,
  delta: number,
  originCenter: { x: number; y: number },
  unionCenter: { x: number; y: number },
  useUnionPivot: boolean,
): unknown {
  const rotated = d.withRotation!(pose, originRotation + delta);
  if (!useUnionPivot) return rotated;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const ox = originCenter.x - unionCenter.x;
  const oy = originCenter.y - unionCenter.y;
  const nx = unionCenter.x + ox * cos - oy * sin;
  const ny = unionCenter.y + ox * sin + oy * cos;
  return translatePoseViaDescriptor(rotated, nx - originCenter.x, ny - originCenter.y, d);
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface RotateScratch {
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  descriptor: PoseDescriptor<unknown>;
  /** World reads and local writes over the scene's composition strategy. */
  frame: PoseFrame<unknown>;
  /** Origin pose for each selected node as stored — the `from` of its op. */
  originPoses: Map<NodeId, unknown>;
  /** Origin pose for each selected node in world — what the gesture turns. */
  originWorlds: Map<NodeId, unknown>;
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
  overrideEntries: Map<NodeId, { pose: unknown }>;
  /** Optional consumer commit hook captured at gesture start. When present,
   *  ops-based commits route through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
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
 * Implements the unrotated-pivot rotation path from `useRotate`.
 *
 * @see useRotate — the React hook this descriptor mirrors for the rect case.
 */
export const rotateAction: Action & { requires: string[] } = {
  id: 'rotate',
  label: 'Rotate',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'poseComposition'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      const descriptor = poseDescriptorOf(ctx.deps.poseDescriptor);
      // The pivot the pointer orbits is a world point, so every pose the
      // gesture turns is a world pose. Each turned result is stored back in
      // the node's own parent frame at preview and commit alike.
      const frame = scenePoseFrame(scene, ctx.deps.poseComposition);
      const originPoses = new Map<NodeId, unknown>();
      const originWorlds = new Map<NodeId, unknown>();
      const originCenters = new Map<NodeId, { x: number; y: number }>();
      const originRotations = new Map<NodeId, number>();
      const visual: Bounds[] = [];

      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        if (!descriptor.withRotation || descriptor.supportsRotation?.(node.pose) === false) continue;
        originPoses.set(id, node.pose);
        // The pivot is a world point, so every measurement the gesture orbits
        // is taken from the world pose, not the stored one.
        const world = frame.world(id);
        originWorlds.set(id, world);
        const b = descriptor.getBounds(world);
        originCenters.set(id, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
        originRotations.set(id, descriptor.getRotation?.(world) ?? 0);
        visual.push(visualBoundsViaDescriptor(world, descriptor));
      }

      if (originPoses.size === 0) return {};

      const union = unionAABB(visual)!;
      const unionCenter = { x: union.x + union.width / 2, y: union.y + union.height / 2 };
      const startPointerAngle = Math.atan2(
        ctx.world.y - unionCenter.y,
        ctx.world.x - unionCenter.x,
      );

      const scratch: RotateScratch = {
        ids,
        scene,
        descriptor,
        frame,
        originPoses,
        originWorlds,
        originCenters,
        originRotations,
        unionCenter,
        startPointerAngle,
        currentDelta: 0,
        useUnionPivot: ids.length > 1,
        previews: new Map<NodeId, unknown>(),
        overrideEntries: new Map<NodeId, { pose: unknown }>(),
        applyOps,
      };

      const recomputePreviews = (delta: number) => {
        scratch.previews.clear();
        if (delta === 0) { syncPreviewOverrides(scratch); return; }
        for (const id of scratch.ids) {
          const origin = scratch.originWorlds.get(id);
          if (origin === undefined) continue;
          const originRotation = scratch.originRotations.get(id) ?? 0;
          const originCenter = scratch.originCenters.get(id) ?? { x: 0, y: 0 };
          const turned = applyRotationDelta(
            scratch.descriptor,
            origin,
            originRotation,
            delta,
            originCenter,
            scratch.unionCenter,
            scratch.useUnionPivot,
          );
          scratch.previews.set(id, scratch.frame.local(id, turned));
        }
        syncPreviewOverrides(scratch);
      };

      return {
        kind: 'rotate',
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
            dropPreviewOverrides(scratch);
            scratch.previews.clear();
            return;
          }
          // No movement — no-op.
          if (scratch.currentDelta === 0) {
            dropPreviewOverrides(scratch);
            scratch.previews.clear();
            return;
          }
          // Build one transform op per affected node — `from` is the
          // pre-mutation origin pose captured at drag start, `to` the rotated
          // preview pose. Routing through the consumer `applyOps` hook (when
          // present) captures the whole drag as one undo entry in the
          // consumer's history; otherwise `scene.applyBatch` records it in the
          // scene's own history. Either way: a single batch / undo entry.
          const ops: Op[] = [];
          for (const id of scratch.ids) {
            const next = scratch.previews.get(id);
            if (next === undefined) continue;
            const from = scratch.originPoses.get(id);
            if (from === undefined) continue;
            ops.push(createTransformOp<unknown>({
              id: id as string,
              from,
              to: next,
              label: 'Rotate',
            }));
          }
          if (ops.length > 0) {
            if (scratch.applyOps) scratch.applyOps(ops, 'Rotate');
            else scratch.scene.applyBatch(ops, 'Rotate', defaultCommitAdapter(scratch.scene));
          }
          dropPreviewOverrides(scratch);
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
};
