/**
 * `cloneAction` — ongoing Action descriptor for alt-drag clone.
 *
 * `start` captures the world pose of every node the copy will hold, `onMove`
 * tracks the drag delta and previews the copies, and `onEnd('commit')` inserts
 * them as one batch — through the consumer `applyOps` hook when present, else
 * `scene.applyBatch`. Nothing is written before the commit, so a cancel only
 * clears the preview.
 *
 * The action does not gate on a modifier: it runs whenever the dispatcher
 * routes to it, and the binding that names it carries the `alt` requirement.
 */

import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { Scene, NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { copySelection } from './copySubtree';
import { selectedRoots, translateTargets } from '../selectionSubtree';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { translatePoseViaDescriptor, type PoseDescriptor } from '../resize/geometry';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { carryPose, invertPlane, inPlane, planeOf, selectionLayer } from '../planeInput';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface CloneScratch {
  /** The selected ids a copy starts from; each brings its subtree. */
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  descriptor: PoseDescriptor<unknown>;
  /** World reads and local writes over the scene's composition strategy. */
  frame: PoseFrame<unknown>;
  /** Origin poses captured at drag start, in world — the frame the drag
   *  delta is expressed in, and the plane the edit is measured in. The copy
   *  keeps its source's parent and layer, so each translated result is
   *  carried back to that layer's plane and stored in that same frame.
   *  Holds every node the copy moves itself: a node stored in a copied frame
   *  is absent, because the copy of that frame carries it. */
  originPoses: Map<NodeId, unknown>;
  /** The view the invocation started with, read for `planeOf`. */
  view: unknown;
  /** Running drag delta — updated each onMove, applied once at commit. */
  currentDelta: { dx: number; dy: number };
  /** Preview poses keyed by the original's id: the copies have no ids yet. */
  previews: Map<NodeId, unknown>;
  /** Optional consumer commit hook captured at gesture start. When present,
   *  the insert ops route through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `clone` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * Copies each selected node, with its subtree, to where the drag left it.
 * One undo entry.
 */
export const cloneAction: Action & { requires: string[] } = inPlane({
  id: 'clone',
  label: 'Clone',
  // No default binding: a bare `{ kind: 'drag' }` would clone a non-empty
  // selection on any drag no tool claimed. Alt-drag on a body binds it
  // (`selectionMoveBindings`, the `move` preset).
  // The platform's duplicate cursor, and the whole reason this field is
  // modifier-aware: the select tool binds clone behind `mods: { alt: true }`,
  // so the pump predicts it — and shows this — only while Alt is down.
  cursor: 'copy',
  activeCursor: 'copy',
  eligible: { capability: ['edits-page', 'creates-selection'] },
  requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'poseComposition'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection;
      const scene = ctx.deps.scene;
      const applyOps = ctx.deps.applyOps;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start.
      const frame = scenePoseFrame(scene, ctx.deps.poseComposition);
      const originPoses = new Map<NodeId, unknown>();
      const descriptor = poseDescriptorOf(ctx.deps.poseDescriptor);
      for (const id of translateTargets(scene, frame, ids)) {
        const node = scene.get(id);
        if (node === undefined) continue;
        const toEdited = invertPlane(planeOf(ctx.deps.view, node.layer));
        originPoses.set(id, carryPose(descriptor, frame.world(id), toEdited));
      }

      if (originPoses.size === 0) return {};

      const scratch: CloneScratch = {
        ids: selectedRoots(scene, ids),
        scene,
        descriptor,
        frame,
        originPoses,
        view: ctx.deps.view,
        currentDelta: { dx: 0, dy: 0 },
        previews: new Map<NodeId, unknown>(),
        applyOps,
      };

      /** Where the copy of `id` lands for a drag of `(dx, dy)`, as stored. */
      const landed = (id: NodeId, dx: number, dy: number): unknown => {
        const origin = scratch.originPoses.get(id);
        const node = scratch.scene.get(id);
        if (origin === undefined || !node) return undefined;
        const moved = translatePoseViaDescriptor(origin, dx, dy, scratch.descriptor);
        return scratch.frame.local(id, carryPose(scratch.descriptor, moved, planeOf(scratch.view, node.layer)));
      };

      return {
        kind: 'clone',
        // Clone: source stays visible at its committed pose; the ghost
        // (rendered via previewIds/previewPose below) appears at the
        // drag target. Opt out of the default "hide source" behavior
        // move/resize/rotate use.
        previewHidesSource: false,
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          scratch.currentDelta = {
            dx: moveCtx.drag.delta.x,
            dy: moveCtx.drag.delta.y,
          };
          // Preview: paint each original's silhouette at the translated pose.
          // The original stays at its committed location (we don't hide it);
          // the ghost overlay shows where the new copy will land on commit.
          scratch.previews.clear();
          const { dx, dy } = scratch.currentDelta;
          if (dx === 0 && dy === 0) return;
          for (const id of scratch.originPoses.keys()) scratch.previews.set(id, landed(id, dx, dy)!);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          const { dx, dy } = scratch.currentDelta;
          // Zero-delta drag — no clone.
          if (dx === 0 && dy === 0) {
            scratch.previews.clear();
            return;
          }

          const { ops, copies } = copySelection(
            scratch.scene,
            scratch.ids,
            (id, node) => (scratch.originPoses.has(id) ? landed(id, dx, dy) : node.pose),
            'Clone',
          );
          if (ops.length > 0) {
            if (scratch.applyOps) scratch.applyOps(ops, 'Clone');
            else scratch.scene.applyBatch(ops, 'Clone', defaultCommitAdapter(scratch.scene, selection.adapterMethods));
            selection.set(copies);
          }
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
}, selectionLayer);
