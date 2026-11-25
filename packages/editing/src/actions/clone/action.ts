/**
 * `cloneAction` — ongoing Action descriptor for alt-drag clone. Nothing is
 * written before the commit, so a cancel only clears the preview.
 *
 * The action does not gate on a modifier: it runs whenever the dispatcher
 * routes to it, and the binding that names it carries the `alt` requirement.
 */

import type { Action, BindingOptions, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { OperandsDep, CloneEnd } from '@weasel-js/core/engine';
import type { Scene, NodeId, Op } from '@weasel-js/core';
import { defaultCommitAdapter, operandMethods, nodeDescriptors, poseDescriptorOf, translatePoseViaDescriptor, type PoseDescriptor, scenePoseFrame, type PoseFrame, SNAP_ROLES } from '@weasel-js/core/engine';
import { runBehaviorCancel, runBehaviorSettled, copyOps, rootsAmong, translateTargets, carryPose, invertPlane, inPlane, planeOf, selectionLayer, recordTransform, forgetTransform, finiteFrame, quantizedPreview } from '@weasel-js/core';
import { startCloneBehaviors, type CloneBehaviors } from './behaviors';
import { beginDragSnap, snappedDelta } from '../move/dragSnap';
import { createEmitter } from '@weasel-js/registry';
import * as coreOps from '@weasel-js/core/ops';

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

/** Where the copy of `id` lands for a drag of `(dx, dy)`, in world. */
function landedWorld(scratch: CloneScratch, id: NodeId, dx: number, dy: number): unknown {
  const origin = scratch.originPoses.get(id);
  const node = scratch.scene.get(id);
  if (origin === undefined || !node) return undefined;
  const d = scratch.descriptorOf(id);
  const moved = translatePoseViaDescriptor(origin, dx, dy, d);
  return carryPose(d, moved, planeOf(scratch.view, node.layer));
}

/** Where the copy of `id` lands for a drag of `(dx, dy)`, as stored: `null` in a singular frame. */
function landed(scratch: CloneScratch, id: NodeId, dx: number, dy: number): unknown {
  const world = landedWorld(scratch, id, dx, dy);
  return world === undefined ? undefined : scratch.frame.local(id, world);
}

/** The copied root `id` is under, or holds. */
function rootOf(scratch: CloneScratch, id: NodeId): NodeId {
  const roots = new Set(scratch.ids);
  let at: NodeId | null = id;
  while (at !== null && !roots.has(at)) at = scratch.scene.get(at)?.parent ?? null;
  return at ?? id;
}

type Placement = Parameters<CloneEnd['copyOps']>[0];

/** How far a placement moves the copy of `root` from where the drag alone leaves it, in world. */
function placementShift(
  scratch: CloneScratch, root: NodeId, placement: Placement, dx: number, dy: number,
): { dx: number; dy: number } {
  const placed = placement.poses.get(root);
  if (placed === undefined) return { dx: 0, dy: 0 };
  const d = scratch.descriptorOf(root);
  const dragged = landedWorld(scratch, root, dx, dy) ?? translatePoseViaDescriptor(scratch.frame.world(root), dx, dy, d);
  const to = d.getBounds(placed);
  const from = d.getBounds(dragged);
  return { dx: to.x - from.x, dy: to.y - from.y };
}

/** The ops making the copies where the drag left them and selecting them;
 *  with a `placement`, each copied root goes under its parent instead, at its
 *  pose there when it has one. `null` when a copy would land in a singular
 *  frame, so the clone refuses whole. */
function placedCopyOps(scratch: CloneScratch, selection: OperandsDep, placement?: Placement): Op[] | null {
  const { dx, dy } = scratch.currentDelta;
  const parent = placement?.parentId as NodeId | null | undefined;
  let refused = false;
  const kept = (pose: unknown, fallback: unknown): unknown => {
    if (pose !== null) return pose;
    refused = true;
    return fallback;
  };
  const { ops, copies } = copyOps(
    scratch.scene,
    scratch.ids,
    (id, node, isRoot) => {
      if (placement === undefined) {
        return scratch.originPoses.has(id) ? kept(landed(scratch, id, dx, dy), node.pose) : node.pose;
      }
      if (isRoot) {
        const world = placement.poses.get(id) ?? landedWorld(scratch, id, dx, dy) ?? node.pose;
        return kept(scratch.frame.localUnder(parent ?? null, world), node.pose);
      }
      // An envelope's child is stored in the frame the envelope sits in, which is now `parent`'s, and lands
      // where the envelope's placement moves it.
      if (!scratch.originPoses.has(id)) return node.pose;
      const world = landedWorld(scratch, id, dx, dy);
      if (world === undefined) return node.pose;
      const shift = placementShift(scratch, rootOf(scratch, id), placement, dx, dy);
      return kept(scratch.frame.localUnder(parent ?? null, translatePoseViaDescriptor(world, shift.dx, shift.dy, scratch.descriptorOf(id))), node.pose);
    },
    'Clone',
    parent,
  );
  if (refused) return null;
  if (ops.length === 0) return [];
  return [...ops, coreOps.setSelection({ from: selection.get(), to: copies, label: 'Clone' })];
}

/** How far the copies a `placement` lands sit from their sources, when every root moved alike; else null. */
function placedOffset(scratch: CloneScratch, placement: Placement | undefined): { dx: number; dy: number } | null {
  const { dx, dy } = scratch.currentDelta;
  if (placement === undefined) return { dx, dy };
  let offset: { dx: number; dy: number } | null = null;
  for (const root of scratch.ids) {
    const shift = placementShift(scratch, root, placement, dx, dy);
    if (offset === null) offset = { dx: dx + shift.dx, dy: dy + shift.dy };
    else if (offset.dx !== dx + shift.dx || offset.dy !== dy + shift.dy) return null;
  }
  return offset;
}

/** Commit the drag: a behavior's ops when one claims it, else the copies,
 *  which become the selection. Says whether anything was committed, and the
 *  offset Transform Again repeats: null unless the commit was copies that all
 *  moved by one offset. */
function commitClone(
  scratch: CloneScratch, behaviors: CloneBehaviors, selection: OperandsDep,
): { committed: boolean; repeat: { dx: number; dy: number } | null } {
  // False when a container refused the copies: the scene reverted them.
  const apply = (ops: Op[]): boolean => {
    if (!scratch.applyOps) return scratch.scene.applyBatch(ops, 'Clone', defaultCommitAdapter(scratch.scene, operandMethods(selection)));
    scratch.applyOps(ops, 'Clone');
    return true;
  };
  const made = new Map<Op[], Placement>();
  const answer = behaviors.end(scratch.currentDelta, (placement) => {
    const ops = placedCopyOps(scratch, selection, placement);
    if (ops !== null) made.set(ops, placement);
    return ops;
  });
  if (answer === null) return { committed: false, repeat: null };
  if (answer !== undefined) {
    if (answer.length === 0) return { committed: true, repeat: null };
    const committed = apply(answer);
    return { committed, repeat: committed && made.has(answer) ? placedOffset(scratch, made.get(answer)) : null };
  }
  const ops = placedCopyOps(scratch, selection);
  const committed = ops !== null && ops.length > 0 && apply(ops);
  return { committed, repeat: committed ? placedOffset(scratch, undefined) : null };
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
  modifierRoles: SNAP_ROLES,
  requires: ['operands', 'scene', 'applyOps', 'poseDescriptor', 'boundsIncludeStroke', 'drawnBoxes', 'kitSettings', 'snap'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOptions): OngoingHandle {
      const selection = ctx.deps.operands;
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
        ids: rootsAmong(scene, ids),
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
      // The source stays put, so it is something the copy can line up with.
      const snap = beginDragSnap(ctx, scratch.ids, []);

      const show = (moveCtx: InvocationCtx): void => {
        const next = finiteFrame({ delta: scratch.currentDelta, previews: scratch.previews }, moveCtx, () => {
          const delta = behaviors.shape(moveCtx, snappedDelta(snap, moveCtx));
          const previews = new Map<NodeId, unknown>();
          if (delta.dx === 0 && delta.dy === 0) return { delta, previews };
          // As the scene's quantize rule will store the copy, which shares its source's data.
          for (const id of scratch.originPoses.keys()) {
            const stored = landed(scratch, id, delta.dx, delta.dy);
            // A copy in a singular frame has no stored pose, and the commit refuses it.
            if (stored === null || stored === undefined) continue;
            previews.set(id, quantizedPreview(scene, id, stored));
          }
          return { delta, previews };
        }, (f) => f.previews);
        scratch.currentDelta = next.delta;
        scratch.previews = next.previews;
      };
      let lastMove: InvocationCtx | null = null;
      const shown = createEmitter();
      behaviors.gctx.refresh = () => {
        if (!lastMove) return;
        show(lastMove);
        shown.emit();
      };

      return {
        kind: 'clone',
        autoPan: true,
        // The source stays visible at its committed pose; the ghost appears
        // at the drag target.
        previewHidesSource: false,
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          lastMove = moveCtx;
          show(moveCtx);
        },
        subscribe: (changed) => shown.subscribe(changed),
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            const { dx, dy } = scratch.currentDelta;
            // A zero-delta drag makes no clone, so its behaviors are canceled.
            if (reason === 'commit' && (dx !== 0 || dy !== 0)) {
              const commit = commitClone(scratch, behaviors, selection);
              committed = commit.committed;
              if (commit.repeat) recordTransform(scene, { kind: 'duplicate', ...commit.repeat }, selection.get());
              else if (committed) forgetTransform(scene);
            } else runBehaviorCancel(behaviors.list, behaviors.gctx);
          } finally {
            snap.snap?.end();
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
