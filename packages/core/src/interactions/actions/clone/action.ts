/**
 * `cloneAction` — ongoing Action descriptor for alt-drag clone. Nothing is
 * written before the commit, so a cancel only clears the preview.
 *
 * The action does not gate on a modifier: it runs whenever the dispatcher
 * routes to it, and the binding that names it carries the `alt` requirement.
 */

import type { Action } from '@weasel-js/routing';
import type { BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { Scene, NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { runBehaviorCancel, runBehaviorSettled } from '../gestureLifecycle';
import { startCloneBehaviors, type CloneBehaviors } from './behaviors';
import type { SelectionApi } from 'core/selection/useSelection';
import { copySelection } from '../defaults/copySubtree';
import { selectedRoots, translateTargets } from '../selectionSubtree';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { translatePoseViaDescriptor, type PoseDescriptor } from '../resize/geometry';
import { scenePoseFrame, type PoseFrame } from '../poseFrame';
import { carryPose, invertPlane, inPlane, planeOf, selectionLayer } from '../planeInput';
import { recordTransform } from '../transform-again/memory';

interface CloneScratch {
  /** The selected ids a copy starts from; each brings its subtree. */
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  descriptorOf: (id: NodeId) => PoseDescriptor<unknown>;
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
   *  the insert ops route through it instead of `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
}

/** Where the copy of `id` lands for a drag of `(dx, dy)`, as stored. */
function landed(scratch: CloneScratch, id: NodeId, dx: number, dy: number): unknown {
  const origin = scratch.originPoses.get(id);
  const node = scratch.scene.get(id);
  if (origin === undefined || !node) return undefined;
  const d = scratch.descriptorOf(id);
  const moved = translatePoseViaDescriptor(origin, dx, dy, d);
  return scratch.frame.local(id, carryPose(d, moved, planeOf(scratch.view, node.layer)));
}

/** Commit the drag: a behavior's ops when one claims it, else the copies,
 *  which become the selection. Returns whether anything was committed. */
function commitClone(scratch: CloneScratch, behaviors: CloneBehaviors, selection: SelectionApi): boolean {
  const { dx, dy } = scratch.currentDelta;
  const apply = (ops: Op[]): void => {
    if (scratch.applyOps) scratch.applyOps(ops, 'Clone');
    else scratch.scene.applyBatch(ops, 'Clone', defaultCommitAdapter(scratch.scene, selection.adapterMethods));
  };
  const answer = behaviors.end(scratch.currentDelta);
  if (answer === null) return false;
  if (answer !== undefined) {
    if (answer.length > 0) apply(answer);
    return true;
  }
  const { ops, copies } = copySelection(
    scratch.scene,
    scratch.ids,
    (id, node) => (scratch.originPoses.has(id) ? landed(scratch, id, dx, dy) : node.pose),
    'Clone',
  );
  if (ops.length === 0) return false;
  apply(ops);
  selection.set(copies);
  return true;
}

/**
 * Static descriptor for the `clone` Action. Copies each selected node, with
 * its subtree, to where the drag left it. One undo entry.
 */
export const cloneAction: Action & { requires: string[] } = inPlane({
  id: 'clone',
  label: 'Clone',
  // No default binding: a bare `{ kind: 'drag' }` would clone a non-empty
  // selection on any drag no tool claimed. Alt-drag on a body binds it
  // (`selectionMoveBindings`, the `move` preset).
  // The platform's duplicate cursor. The select tool binds clone behind
  // `mods: { alt: true }`, so the pump shows this only while Alt is down.
  cursor: 'copy',
  activeCursor: 'copy',
  eligible: { capability: ['edits-page', 'creates-selection'] },
  requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'boundsIncludeStroke', 'kitSettings'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection;
      const scene = ctx.deps.scene;
      const applyOps = ctx.deps.applyOps;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start.
      const frame = scenePoseFrame(scene);
      const originPoses = new Map<NodeId, unknown>();
      const descriptorOf = nodeDescriptors(scene, poseDescriptorOf(ctx.deps.poseDescriptor));
      for (const id of translateTargets(scene, frame, ids)) {
        const node = scene.get(id);
        if (node === undefined) continue;
        const toEdited = invertPlane(planeOf(ctx.deps.view, node.layer));
        originPoses.set(id, carryPose(descriptorOf(id), frame.world(id), toEdited));
      }

      if (originPoses.size === 0) return {};

      const scratch: CloneScratch = {
        ids: selectedRoots(scene, ids),
        scene,
        descriptorOf,
        frame,
        originPoses,
        view: ctx.deps.view,
        currentDelta: { dx: 0, dy: 0 },
        previews: new Map<NodeId, unknown>(),
        applyOps,
      };
      const behaviors = startCloneBehaviors(ctx, opts, scene, scratch.ids, originPoses, descriptorOf);

      return {
        kind: 'clone',
        // The source stays visible at its committed pose; the ghost appears
        // at the drag target.
        previewHidesSource: false,
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          scratch.currentDelta = behaviors.shape(moveCtx, { dx: moveCtx.drag.delta.x, dy: moveCtx.drag.delta.y });
          scratch.previews.clear();
          const { dx, dy } = scratch.currentDelta;
          if (dx === 0 && dy === 0) return;
          for (const id of scratch.originPoses.keys()) scratch.previews.set(id, landed(scratch, id, dx, dy)!);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            const { dx, dy } = scratch.currentDelta;
            // A zero-delta drag makes no clone, so its behaviors are canceled.
            if (reason === 'commit' && (dx !== 0 || dy !== 0)) {
              committed = commitClone(scratch, behaviors, selection);
              if (committed) recordTransform(scene, { kind: 'duplicate', dx, dy }, selection.get());
            } else runBehaviorCancel(behaviors.list, behaviors.gctx);
          } finally {
            scratch.previews.clear();
            runBehaviorSettled(behaviors.list, behaviors.gctx, committed);
          }
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
}, selectionLayer);
