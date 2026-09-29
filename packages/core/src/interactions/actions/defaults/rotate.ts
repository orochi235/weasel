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
 * - Behaviors (`opts.behaviors`) see the first rotated node's turned pose; a
 *   pose one returns from `onMove` sets the rotation for the whole selection.
 * - No overlay rendering — deferred to Phase 7 overlay surface.
 * - Shift-snap (15° quantum) is NOT wired in this phase — omitted deliberately
 *   to keep the invoker self-contained (would need to read shift from onMove ctx).
 *   TODO: thread shift from InvocationCtx.modifiers.shift into snap logic.
 */

import { gesturePlaneReader, gestureViewReader } from '../../gestures/shared/screenTolerance';
import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
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
  poseDescriptorForNode,
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
  type PoseDescriptor,
} from '../resize/geometry';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { commitGestureOps, readGestureLifecycle, reduceBehaviorEnd, runBehaviorCancel, type GestureLifecycle } from '../gestureLifecycle';
import { moveGestureAdapter } from '../move/gestureAdapter';
import type { GestureContext, RotateBehavior, RotateProposed } from '../../gestures/types';
import { carryPose, invertPlane, inPlane, planeOf, selectionLayer } from '../planeInput';

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
  lifecycle: GestureLifecycle;
  behaviors: RotateBehavior<unknown>[];
  /** Reused gesture context handed to behaviors across the drag. */
  gestureCtx: GestureContext<unknown>;
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
export const rotateAction: Action & { requires: string[] } = inPlane({
  id: 'rotate',
  label: 'Rotate',
  // No default binding. It used to be a bare `{ kind: 'drag' }`, which made
  // any drag no active tool claimed rotate a non-empty selection. The rotation
  // handle binds it (`selectionTransformBindings`, the `transform` preset).
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'poseComposition', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      const params = resolveParams(opts?.params);
      const behaviors = (opts?.behaviors ?? []) as RotateBehavior<unknown>[];

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
        const g = poseDescriptorForNode(descriptor, node);
        if (!g.withRotation || g.supportsRotation?.(node.pose) === false) continue;
        originPoses.set(id, node.pose);
        // The pivot is a world point, so every measurement the gesture orbits
        // is taken from the world pose, not the stored one — carried into the
        // plane the edit is measured in, where the pointer's angle is read.
        const world = carryPose(g, frame.world(id), invertPlane(planeOf(ctx.deps.view, node.layer)));
        originWorlds.set(id, world);
        const b = g.getBounds(world);
        originCenters.set(id, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
        originRotations.set(id, g.getRotation?.(world) ?? 0);
        visual.push(visualBoundsViaDescriptor(world, g));
      }

      if (originPoses.size === 0) return {};

      const union = unionAABB(visual)!;
      const unionCenter = { x: union.x + union.width / 2, y: union.y + union.height / 2 };
      const startPointerAngle = Math.atan2(
        ctx.world.y - unionCenter.y,
        ctx.world.x - unionCenter.x,
      );

      const readView = gestureViewReader(ctx.deps);
      const view = ctx.deps.view;

      const readPlane = gesturePlaneReader(ctx.deps);
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
        useUnionPivot: ids.length > 1 && params?.['pivot'] !== 'each',
        previews: new Map<NodeId, unknown>(),
        overrideEntries: new Map<NodeId, { pose: unknown }>(),
        applyOps,
        lifecycle: readGestureLifecycle(params, 'Rotate', behaviors),
        behaviors,
        gestureCtx: {
          draggedIds: [...originPoses.keys()] as string[],
          origin: new Map([...originWorlds].map(([id, p]) => [id as string, p])),
          current: new Map([...originWorlds].map(([id, p]) => [id as string, p])),
          snap: null,
          modifiers: { ...ctx.modifiers },
          pointer: { worldX: ctx.world.x, worldY: ctx.world.y, clientX: 0, clientY: 0 },
          view: readView(),
          plane: readPlane(),
          adapter: moveGestureAdapter(scene) as unknown as GestureContext<unknown>['adapter'],
          scratch: {},
        },
      };
      const { lifecycle } = scratch;

      /** Each rotated node's world pose turned by `delta`. */
      const turnedWorlds = (delta: number): Map<NodeId, unknown> => {
        const out = new Map<NodeId, unknown>();
        for (const [id, origin] of scratch.originWorlds) {
          out.set(id, applyRotationDelta(
            scratch.descriptor,
            origin,
            scratch.originRotations.get(id) ?? 0,
            delta,
            scratch.originCenters.get(id) ?? { x: 0, y: 0 },
            scratch.unionCenter,
            scratch.useUnionPivot,
          ));
        }
        return out;
      };

      const syncGestureCurrent = (delta: number): Map<NodeId, unknown> => {
        const turned = turnedWorlds(delta);
        for (const [id, pose] of turned) scratch.gestureCtx.current.set(id as string, pose);
        return turned;
      };

      /** The pointer's delta as the behaviors reshape it. */
      const shapeDelta = (moveCtx: InvocationCtx, raw: number): number => {
        const gctx = scratch.gestureCtx;
        gctx.modifiers = { ...moveCtx.modifiers };
        gctx.pointer = { worldX: moveCtx.world.x, worldY: moveCtx.world.y, clientX: 0, clientY: 0 };
        gctx.view = readView();
        gctx.plane = readPlane();
        const primary = scratch.originWorlds.keys().next().value as NodeId;
        const originRotation = scratch.originRotations.get(primary) ?? 0;
        let delta = raw;
        let proposed: RotateProposed<unknown> = {
          pose: syncGestureCurrent(raw).get(primary),
          rotation: originRotation + raw,
        };
        for (const b of scratch.behaviors) {
          const r = b.onMove?.(gctx, proposed);
          if (!r || r.pose === undefined) continue;
          const rotation = scratch.descriptor.getRotation?.(r.pose) ?? 0;
          delta = rotation - originRotation;
          proposed = { pose: r.pose, rotation };
        }
        return delta;
      };

      // Returns whether anything reached the document.
      const commitRotate = (): boolean => {
        const target = {
          scene,
          applyOps: scratch.applyOps,
          adapter: defaultCommitAdapter(scene, selection.adapterMethods),
        };
        if (scratch.behaviors.length > 0) {
          syncGestureCurrent(scratch.currentDelta);
          const r = reduceBehaviorEnd(scratch.behaviors, scratch.gestureCtx);
          if (r === null) return false;
          if (r !== undefined) {
            commitGestureOps(target, lifecycle, r);
            return true;
          }
        }
        if (scratch.currentDelta === 0) return false;
        // One transform op per node: `from` is the origin pose captured at drag
        // start, `to` the rotated preview. A single batch, so one undo entry.
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
            label: lifecycle.label,
          }));
        }
        if (ops.length === 0) return false;
        commitGestureOps(target, lifecycle, ops);
        return true;
      };

      const recomputePreviews = (delta: number) => {
        scratch.previews.clear();
        if (delta !== 0) {
          for (const [id, turned] of turnedWorlds(delta)) {
            const layer = scratch.scene.get(id)?.layer;
            const own = layer === undefined ? null : planeOf(view, layer);
            scratch.previews.set(id, scratch.frame.local(id, carryPose(scratch.descriptor, turned, own)));
          }
        }
        syncPreviewOverrides(scratch);
      };

      for (const b of behaviors) b.onStart?.(scratch.gestureCtx);
      lifecycle.start(scratch.gestureCtx.draggedIds);

      return {
        kind: 'rotate',
        onMove(moveCtx: InvocationCtx): void {
          const pointerAngle = Math.atan2(
            moveCtx.world.y - scratch.unionCenter.y,
            moveCtx.world.x - scratch.unionCenter.x,
          );
          const raw = pointerAngle - scratch.startPointerAngle;
          scratch.currentDelta = scratch.behaviors.length > 0 ? shapeDelta(moveCtx, raw) : raw;
          recomputePreviews(scratch.currentDelta);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            if (reason === 'commit') committed = commitRotate();
            else runBehaviorCancel(scratch.behaviors, scratch.gestureCtx);
          } finally {
            dropPreviewOverrides(scratch);
            scratch.previews.clear();
            lifecycle.end(committed);
          }
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
}, selectionLayer);
