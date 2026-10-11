/**
 * `moveAction` — first `ongoing`-timing Action descriptor.
 *
 * A per-frame translate of the selection:
 *   - `start`: capture origin poses for all selected nodes; record the
 *     current drag delta in scratch each frame.
 *   - `onMove`: update the in-scratch `currentDelta`, and publish the frame's
 *     poses as ephemeral overrides. No *document* writes, so the undo stack
 *     still sees one entry for the whole drag.
 *   - `onEnd('commit')`: emit the final delta as transform ops and commit
 *     them as one batch (`commitGestureOps`) → at most one undo entry for the
 *     whole drag, none when the binding's params make it transient.
 *   - `onEnd('cancel')`: drop the overrides — the document was never mutated,
 *     so the committed poses are the restoration.
 *
 * ## Why no per-frame document writes
 *
 * `Scene.setPose` calls `executeAndLog`, which immediately records an undo
 * entry on the scene's history engine. Per-frame writes during drag would
 * create O(frames) history entries, so the drag commits one
 * `createTransformOp` batch at the end.
 *
 * The per-frame poses still go *somewhere* the scene can see: the ephemeral
 * override table, which bypasses history entirely. That is what lets a node
 * deriving its geometry from a dragged one follow the drag — `sceneDepLookup`
 * and the pick source both read overrides, and neither can see this action's
 * scratch. Keeping the frame in scratch alone is why the edge used to stay
 * anchored to the old endpoint and jump on drop.
 *
 * The behavior pipeline (snap-to-grid, snap-back-or-delete, snap-to-container,
 * etc.) via `opts.behaviors` from `BindingOpts` IS wired: `start` builds a
 * `GestureContext` + scene-backed adapter (`moveGestureAdapter`), `onMove`
 * folds each behavior's proposed-transform result, and `onEnd` runs a
 * first-non-undefined-wins reducer (`Op[]` commits via `commitGestureOps`,
 * `null` aborts, all-`undefined` falls through to the default translate path).
 *
 * ## Pose generics
 *
 * Poses are `unknown`; every read and write goes through the `poseDescriptor`
 * dep (`AUTO_POSE_DESCRIPTOR` when unsourced).
 */

import { gesturePlaneReader, gestureViewReader } from '../../gestures/shared/screenTolerance';
import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '@weasel-js/routing';
import { resolveParams, DRAG_THRESHOLD_PX, pastDragThreshold } from '@weasel-js/routing';
import { effectivePose } from 'core/scene/effectivePose';
import { scenePoseAdapter } from 'features/groups/scenePoseAdapter';
import type { NodeId } from 'core/scene/types';
import { syncPreviewOverrides, dropPreviewOverrides } from '../previewOverrides';
import { commitGestureOps, readGestureLifecycle, reduceBehaviorEnd, runBehaviorCancel } from '../gestureLifecycle';
import { asNodeId } from 'core/scene/types';
import { moveSources } from '../selectionSubtree';
import { SceneArrivalRefused } from 'core/scene/arrivals';
import type { Op } from 'core/ops/types';
import {
  translatePoseViaDescriptor,
} from '../resize/geometry';
import { nodeDescriptors, poseDescriptorOf } from '../poseDescriptorDep';
import { isAnchorOrControl } from '@weasel-js/routing';
import type { MoveBehavior, GroupTransform, GestureContext, BehaviorResult } from '../../gestures/types';
import { moveGestureAdapter } from './gestureAdapter';
import { landedDescendantOps } from './landedDescendants';
import {
  composeWorldPose,
  frameAtOrAbove,
  rebaseLocalPose,
  IDENTITY_POSE_COMPOSITION,
  type PoseComposition,
} from 'features/groups/composePose';
import { carryPose, invertPlane, inPlane, planeOf, selectionLayer } from '../planeInput';
import { planeToPlane, toPlane } from 'core/viewport/parallax';
import type { MoveLive, MoveSession, ReparentOnDrop } from './session';
import { runDropPass } from './layout/dropPass';
import { catchGliding, landReleased, releasedPoses, stepGlide } from './layout/glide';
import { draggedWorldPose, localDelta, planeDelta } from './delta';
import { translateOps } from './translate';
import { layoutDropOps } from './commit/layoutDrop';
import { layoutReleaseOps } from './commit/layoutRelease';
export type { ReparentOnDrop };

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

/** Transitional: every helper is narrowed off this by the end of the plan. */
type MoveScratch = MoveSession & MoveLive;

function capturePlaneRefs(
  scene: MoveSession['scene'],
  ids: MoveSession['ids'],
  view: unknown,
  frames: MoveSession['frames'],
  startPoses: MoveSession['startPoses'],
  projection: MoveSession['projection'],
): MoveSession['planeRefs'] {
  const planeRefs = new Map<string, { own: { x: number; y: number }; edited: { x: number; y: number } }>();
  for (const id of ids) {
    const layer = scene.get(id)?.layer;
    if (layer === undefined || planeRefs.has(layer)) continue;
    const m = planeOf(view, layer);
    if (m === null) continue;
    const world = frames.get(id)?.world ?? startPoses.get(id);
    if (world === undefined) continue;
    const b = projection.getBounds(world);
    const own = { x: b.x, y: b.y };
    planeRefs.set(layer, { own, edited: toPlane(invertPlane(m)!, own) });
  }
  return planeRefs;
}

/** Resolved drop target — the new parent + layer + (for `'above'` mode)
 *  the hit sibling whose z-order position the moved node should land
 *  immediately above. `newParent === null` means "land at the layer
 *  root" (top-level node of `newLayer`). */
interface DropTarget {
  newParent: NodeId | null;
  newLayer: string;
  hitSibling: NodeId | null;
}

/** Walk the hit chain to find the appropriate drop target. Returns
 *  `null` when no reparent should happen (drop on empty canvas, or the
 *  only hits are the moved subtree itself). */
function resolveDropTarget(
  endCtx: InvocationCtx,
  scratch: MoveScratch,
): DropTarget | null {
  const dep = scratch.nodeAtPoint;
  if (!dep) return null;
  // An end with no drag carries no pointer: the dispatcher's `cancelAll`
  // reports the world origin.
  const at = endCtx.drag ? endCtx.world : scratch.lastWorld;
  if (!at) return null;

  // Exclude moved roots + their descendants. Otherwise we'd happily
  // reparent a node into itself (or under one of its own children).
  const exclude = new Set<NodeId>([...scratch.ids, ...scratch.cascadeIds]);
  const hit = dep(at, exclude);
  if (!hit) return null;

  const hitNode = scratch.scene.get(hit);
  if (!hitNode) return null;

  // Containers act as drop-INTO targets; leaves act as drop-NEXT-TO
  // targets (parent = leaf's parent). When the leaf has no parent
  // (top-level under a layer), `newParent === null` and the moved
  // subtree lands at the layer root.
  if (hitNode.kind === 'container') {
    return { newParent: hit, newLayer: hitNode.layer, hitSibling: null };
  }
  return {
    newParent: hitNode.parent,
    newLayer: hitNode.layer,
    hitSibling: hit,
  };
}

/** Reparent + reposition each moved root. Pose math: the preview during
 *  the drag showed the node at `originWorldPose + (dx, dy)`. To preserve
 *  that world position after the parent swap, we compute the equivalent
 *  local pose under `newParent`'s frame via `rebaseLocalPose`. */
function applyReparent(
  scratch: MoveScratch,
  target: DropTarget,
  mode: ReparentOnDrop,
  dx: number,
  dy: number,
  pc: PoseComposition<unknown>,
): void {
  const scene = scratch.scene;
  const poseAdapter = scenePoseAdapter(scene);
  // Descendants no moved frame carries hold poses of their own, and follow
  // the drag as they do in the translate commit.
  const followerOps = translateOps(scratch, scratch.cascadeIds, { dx, dy });

  for (const id of scratch.ids) {
    if (!scratch.startPoses.has(id)) continue;

    // World pose the user dragged the node to. `composeWorldPose` folds
    // ancestor offsets in for nested nodes; for top-level nodes it
    // collapses to the local pose. The drag delta is in world space, so
    // it adds in directly. Reads from the current scene state, which is
    // unchanged from drag start because `moveAction` doesn't write
    // during `onMove`.
    const layer = scene.get(id)!.layer;
    // Landing on another plane's layer, the pose crosses into that plane.
    const draggedWorld = carryPose(
      scratch.descriptorOf(id),
      draggedWorldPose(scratch, poseAdapter, id, { dx, dy }),
      layer === target.newLayer
        ? null
        : planeToPlane(planeOf(scratch.view, layer), planeOf(scratch.view, target.newLayer)),
    );
    const newLocal = rebaseLocalPose(
      poseAdapter,
      draggedWorld,
      target.newParent as string | null,
      pc.compose,
      pc.decompose,
    );

    // Cross-layer reparent requires orphaning before relayer (scene
    // refuses `setLayer` on a node whose parent is on a different
    // layer). For same-parent reorders or same-layer reparents this
    // collapses to a single `move` + `setPose`.
    const node = scene.get(id)!;
    if (node.layer !== target.newLayer) {
      if (node.parent !== null) scene.move(id, null);
      scene.setLayer(id, target.newLayer as never);
    }

    // Destination index. `'above'` mode needs a hit sibling that shares
    // `newParent`; otherwise fall through to `'top'` (index = undefined
    // appends to end). `scene.move` detach-then-attaches, so the index
    // is interpreted relative to the *post-detach* sibling list — we
    // filter the moving id out before computing the slot or we'd land
    // one position too far down when the moving node was previously a
    // sibling preceding the hit.
    let index: number | undefined;
    if (mode === 'above' && target.hitSibling) {
      const rawSiblings = target.newParent === null
        ? scene.roots
        : scene.childrenOf(target.newParent);
      const siblings = rawSiblings.filter((sid) => sid !== id);
      const hitIdx = siblings.indexOf(target.hitSibling);
      if (hitIdx >= 0) index = hitIdx + 1;
    }

    scene.move(id, target.newParent, index);
    scene.setPose(id, newLocal as never);
  }
  for (const op of followerOps) op.apply(scratch.adapter);
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `move` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` — it returns an `OngoingHandle` from `start` that
 * the dispatcher pumps via `onMove`/`onEnd` for the duration of the drag.
 */
export const moveAction: Action & { requires: string[] } = inPlane({
  id: 'move',
  label: 'Move',
  // No hover `cursor`: pointing at a node shouldn't preemptively promise a
  // move, matching what `useSelectTool` showed before its scratch-driven
  // cursor was retired. Once the drag is running, it's a move.
  activeCursor: 'move',
  // Ambient default targets `selected-body` so a host without an explicit
  // select-tool binding still gets drag-to-move on the selection — but ONLY
  // on the selected body. A bare `{ kind: 'drag' }` catches every drag in
  // ambient scope and bleeds the move into drawing-tool gestures (any path
  // where the higher-priority active match falls through). Drawing tools
  // bind bare drag at active scope and outrank this; the symptom of
  // "drawing tools move the selection" disappears once the ambient binding
  // is target-qualified instead of universal.
  defaultBinding: { kind: 'drag', target: 'selected-body' },
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene', 'poseDescriptor', 'layout', 'applyOps', 'poseComposition', 'geometryProjection', 'nodeAtPoint', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection;
      const scene = ctx.deps.scene;
      const projection = poseDescriptorOf(ctx.deps.poseDescriptor);
      const layout = ctx.deps.layout;
      const applyOps = ctx.deps.applyOps;
      const geometryProjection = ctx.deps.geometryProjection;
      // Pose-composition strategy: how the consumer's scene folds local poses
      // up to world (and back). Absent → IDENTITY (absolute-pose: nodes store
      // world coords, parents are grouping-only). Local-pose consumers supply
      // { compose: composeRectPose, decompose: decomposeRectPose }.
      const pc = ctx.deps.poseComposition
        ?? IDENTITY_POSE_COMPOSITION;

      if (!selection || !scene) return {};
      // Anchors sit on the selected body, and this binding ties editAnchors' on
      // specificity; with no mode registry to filter move out, declining is what lets it through.
      if (isAnchorOrControl(ctx.drag?.affordance)) return {};

      const params = resolveParams(opts?.params);
      const expandIds = params?.['expandIds'] as ((ids: string[]) => string[]) | undefined;
      const selected = [...selection.get()] as string[];
      const ids = moveSources(scene, expandIds ? expandIds(selected) : selected) as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start. Walk descendants so
      // container drags can preview every displaced child — required by
      // `usePreviewGhostLayer.buildSubtree` which only recurses into ids
      // present in `previewIds()`.
      const startPoses = new Map<NodeId, unknown>();
      const cascadeIds: NodeId[] = [];
      const seen = new Set<NodeId>();
      const queue: NodeId[] = [];
      // A node still gliding from an earlier reflow is held where it is
      // shown, and the drag starts from there.
      const reflow = layout?.reflow ?? null;
      const caught = new Map<NodeId, { dx: number; dy: number }>();
      const hold = (id: NodeId): void => {
        const held = catchGliding(scene, reflow, projection, id);
        if (held) caught.set(id, held);
      };
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        hold(id);
        startPoses.set(id, effectivePose(scene, node));
        seen.add(id);
        queue.push(id);
      }
      while (queue.length > 0) {
        const parent = queue.shift()!;
        for (const childId of scene.childrenOf(parent)) {
          if (seen.has(childId)) continue;
          seen.add(childId);
          const childNode = scene.get(childId);
          if (!childNode) continue;
          hold(childId);
          startPoses.set(childId, effectivePose(scene, childNode));
          cascadeIds.push(childId);
          queue.push(childId);
        }
      }

      const carried = new Set<NodeId>();
      const frames = new Map<NodeId, { world: unknown; frameWorld: unknown }>();
      if (pc.closure !== 'identity') {
        const poseAdapter = scenePoseAdapter(scene);
        for (const id of startPoses.keys()) {
          const frame = frameAtOrAbove(poseAdapter, scene.get(id)?.parent ?? null);
          if (frame === null) continue;
          if (startPoses.has(asNodeId(frame))) {
            carried.add(id);
            continue;
          }
          frames.set(id, {
            world: composeWorldPose(poseAdapter, id as string, pc.compose),
            frameWorld: composeWorldPose(poseAdapter, frame, pc.compose),
          });
        }
      }

      const behaviors = (opts?.behaviors ?? []) as MoveBehavior<unknown>[];
      const dragThresholdPx = (params?.['dragThresholdPx'] as number | undefined)
        ?? DRAG_THRESHOLD_PX;
      const lifecycle = readGestureLifecycle(params, 'Move', behaviors);
      let engaged = false;
      // A behavior that commits after the gesture has ended, a coast coming to
      // rest, lands its batch the way the gesture's own commit does.
      const adapter = moveGestureAdapter<unknown>(scene, (ops, _label, through) =>
        commitGestureOps({ scene, applyOps, adapter: through }, lifecycle, ops));
      const origin = new Map<string, unknown>();
      for (const [id, pose] of startPoses) origin.set(id as string, pose);
      const readView = gestureViewReader(ctx.deps);
      const readPlane = gesturePlaneReader(ctx.deps);
      const gestureCtx: GestureContext<unknown> = {
        draggedIds: ids as unknown as string[],
        origin,
        current: new Map(origin),
        snap: null,
        modifiers: { ...ctx.modifiers },
        pointer: { worldX: ctx.world.x, worldY: ctx.world.y, clientX: 0, clientY: 0 },
        view: readView(),
        plane: readPlane(),
        adapter: adapter as unknown as GestureContext<unknown>['adapter'],
        scratch: {},
      };
      for (const b of behaviors) b.onStart?.(gestureCtx);

      const scratch: MoveScratch = {
        startPoses,
        ids,
        cascadeIds,
        carried,
        frames,
        scene,
        currentDelta: { dx: 0, dy: 0 },
        view: ctx.deps.view,
        planeRefs: capturePlaneRefs(scene, ids, ctx.deps.view, frames, startPoses, projection),
        previews: new Map<NodeId, unknown>(),
        overrideEntries: new Map<NodeId, { pose: unknown }>(),
        reflowTargets: new Map<NodeId, unknown>(),
        gliding: new Set<NodeId>(),
        caught,
        projection,
        descriptorOf: nodeDescriptors(scene, projection),
        behaviors,
        gestureCtx,
        adapter,
        layout,
        layoutPass: null,
        dropCenter: null,
        pc,
        applyOps,
        geometryProjection,
        lifecycle,
        nodeAtPoint: ctx.deps.nodeAtPoint,
        lastWorld: null,
        reparentOnDrop: () => (resolveParams(opts?.params)?.['reparentOnDrop'] as ReparentOnDrop | undefined) ?? 'off',
        dragThresholdPx,
      };

      // Returns whether anything reached the document.
      const commitMove = (endCtx: InvocationCtx): boolean => {
        // Apply the final delta as a single batch → one undo entry.
        const { dx, dy } = scratch.currentDelta;
        let committed = false;
        const commitOps = (ops: Op[]): void => {
          const followers = landedDescendantOps(
            { ...scratch, roots: scratch.ids, label: lifecycle.label }, ops,
          );
          commitGestureOps(scratch, lifecycle, [...ops, ...followers]);
          committed = true;
        };

        // Behavior pipeline owns the commit if any behavior returns non-undefined.
        if (scratch.behaviors.length > 0) {
          const gctx = scratch.gestureCtx;
          for (const [id, ori] of scratch.startPoses) {
            const own = planeDelta(scratch, id, dx, dy);
            gctx.current.set(id as string, translatePoseViaDescriptor(ori, own.dx, own.dy, scratch.descriptorOf(id)));
          }
          const r = reduceBehaviorEnd(scratch.behaviors, gctx);
          if (r === null) return false;           // abort (e.g. snap-back)
          if (r !== undefined) {
            commitOps(r);
            return true;
          }
        }

        // No-op if no movement (sub-threshold drag or zero delta).
        if (dx === 0 && dy === 0) return false;

        // Layout drop commit — takes precedence over reparent-on-drop when a
        // layout container accepted the drag this gesture. One placement per
        // dragged child, replayed in the order the preview resolved them.
        // TODO: geometryProjection for drop-reflow — left pose-only because the
        // reflow distributes per-child poses with no single global delta; not
        // exercised by the geometry contract gate.
        if (scratch.layout && scratch.layoutPass) {
          const ops = layoutDropOps(scratch, scratch.layoutPass);
          if (ops.length > 0) commitOps(ops);
          return committed;
        }
        const release = scratch.layout ? layoutReleaseOps(scratch, { dx, dy }, scratch.dropCenter) : undefined;
        if (release !== undefined) {
          if (release.length > 0) commitOps(release);
          return committed;
        }

        // Reparent-on-drop, when opted in via `opts.params.reparentOnDrop`.
        // Resolves the drop target via the `nodeAtPoint` dep (sourced by
        // `<SceneCanvas>`) and reparents each moved root under it, then
        // writes the translated pose in the new parent's frame so the
        // visual position is preserved across the parent swap.
        const reparentMode = scratch.reparentOnDrop();
        const dropTarget = reparentMode !== 'off'
          ? resolveDropTarget(endCtx, scratch)
          : null;

        if (dropTarget) {
          // Reparent-on-drop still commits directly to the scene. Routing
          // this path through `commitOps` is a separate later task.
          const reparent = () => applyReparent(scratch, dropTarget, reparentMode, dx, dy, scratch.pc);
          try {
            if (lifecycle.transient) scratch.scene.untracked(reparent);
            else scratch.scene.batch(lifecycle.label, reparent);
            committed = true;
          } catch (err) {
            // The container refused what was dropped into it; like a layout
            // drop with no target, the drag lands nothing.
            if (!(err instanceof SceneArrivalRefused)) throw err;
          }
        } else {
          // No reparent — translate-only commit, emitted as transform ops so
          // it routes through the consumer `applyOps` hook (consumer history)
          // when present, else the scene's own history. Under scene v1's
          // absolute-pose semantics every node stores world coords
          // independently, so a container drag must explicitly re-stamp every
          // cascaded descendant by the same dx/dy — otherwise children stay at
          // their old absolute positions (visually they snap to the
          // container's former location).
          // Translate the data-held geometry by the same (dx,dy). Opt-in via
          // the geometryProjection seam; a no-op when the dep is absent.
          const ops = translateOps(scratch, [...scratch.ids, ...scratch.cascadeIds], { dx, dy });
          if (ops.length > 0) commitOps(ops);
        }
        return committed;
      };

      return {
        kind: 'move',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          scratch.lastWorld = moveCtx.world;
          if (!engaged) {
            const s = moveCtx.drag.screenDelta;
            if (s && !pastDragThreshold({ clientX: 0, clientY: 0 }, { clientX: s.x, clientY: s.y }, dragThresholdPx)) return;
            engaged = true;
            lifecycle.start(ids as string[]);
          }
          let dx = moveCtx.drag.delta.x;
          let dy = moveCtx.drag.delta.y;

          const posed = new Map<NodeId, unknown>();
          if (scratch.behaviors.length > 0) {
            const gctx = scratch.gestureCtx;
            gctx.modifiers = { ...moveCtx.modifiers };
            gctx.pointer = { worldX: moveCtx.drag.current.x, worldY: moveCtx.drag.current.y, clientX: 0, clientY: 0 };
            gctx.view = readView();
            gctx.plane = readPlane();
            // `current` is pre-populated from the raw cursor delta BEFORE
            // any behavior shapes `transform`. Unlike `onEnd`, it is NOT
            // refreshed after each behavior runs — so onMove behaviors
            // should derive position from `origin` + the `proposed`
            // GroupTransform arg, NOT from `ctx.current` (which reflects
            // the unmodified delta at this frame's start).
            for (const [id, ori] of scratch.startPoses) {
              const own = planeDelta(scratch, id, dx, dy);
              gctx.current.set(id as string, translatePoseViaDescriptor(ori, own.dx, own.dy, scratch.descriptorOf(id)));
            }
            let transform: GroupTransform = { kind: 'translate', dx, dy };
            const primary = scratch.ids[0] as NodeId | undefined;
            for (const b of scratch.behaviors) {
              const r: BehaviorResult<unknown> | void = b.onMove?.(gctx, transform);
              if (!r) continue;
              if (r.poses) for (const [id, pose] of r.poses) posed.set(id as NodeId, pose);
              if (r.transform && r.transform.kind === 'translate') {
                transform = r.transform;
              } else if (r.pose !== undefined && primary !== undefined) {
                const o = scratch.startPoses.get(primary);
                if (o !== undefined) {
                  const from = scratch.projection.getBounds(o);
                  const to = scratch.projection.getBounds(r.pose);
                  transform = { kind: 'translate', dx: to.x - from.x, dy: to.y - from.y };
                }
              }
              if (r.snap !== undefined) gctx.snap = r.snap;
            }
            if (transform.kind === 'translate') { dx = transform.dx; dy = transform.dy; }
          }

          // Track delta in scratch only — no scene writes, no history entries.
          scratch.currentDelta = { dx, dy };
          // Refresh preview poses for every displaced id (roots + cascade).
          // The preview-ghost layer reads these via `previewIds`/`previewPose`.
          scratch.previews.clear();
          for (const [id, ori] of scratch.startPoses) {
            if (scratch.carried.has(id)) {
              scratch.previews.set(id, ori);
              continue;
            }
            const l = localDelta(scratch, id, dx, dy);
            scratch.previews.set(id, posed.get(id) ?? translatePoseViaDescriptor(ori, l.dx, l.dy, scratch.descriptorOf(id)));
          }

          // Layout reflow pass — no-op without a layout dep.
          const drop = runDropPass(scratch, scratch.currentDelta, moveCtx.drag.current);
          scratch.dropCenter = drop?.dropCenter ?? null;
          scratch.layoutPass = drop?.pass ?? null;
          scratch.reflowTargets.clear();
          const reflow = scratch.layout?.reflow;
          for (const [id, pose] of drop?.reflow ?? []) {
            if (reflow) scratch.reflowTargets.set(id, pose);
            else scratch.previews.set(id, pose);
          }
          if (reflow) stepGlide(reflow, scratch.gliding, scratch.reflowTargets);

          // After the layout pass, so a reflowed sibling publishes too.
          syncPreviewOverrides(scratch);
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          const reflow = scratch.layout?.reflow ?? null;
          const released = reflow ? releasedPoses(scratch, scratch.previews) : null;
          try {
            // On cancel the document was never mutated — dropping the
            // ephemeral overrides below restores the committed poses.
            // A press that never traveled `dragThresholdPx` was never a move:
            // its behaviors started, so they are canceled, not asked to commit.
            if (reason === 'commit' && engaged) committed = commitMove(endCtx);
            else runBehaviorCancel(scratch.behaviors, scratch.gestureCtx);
          } finally {
            // After the commit, so no frame can paint the pre-drag pose between
            // the override going away and the document catching up.
            dropPreviewOverrides(scratch);
            scratch.previews.clear();
            // Also after the commit: each glide settles onto the pose the
            // document now holds, or back home on a cancel — the dragged ids
            // from where they were let go.
            if (reflow && released) {
              for (const id of scratch.gliding) reflow.settle(id as string);
              landReleased(scratch, reflow, released);
            }
            scratch.gliding.clear();
            lifecycle.end(committed);
          }
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
        previewOpaqueIds: () => scratch.layoutPass?.reflowIds ?? null,
      };
    },
  },
  /**
   * Always enabled at the descriptor level. The dispatcher's
   * specificity-fallthrough loop (`dispatcher.ts`) treats anything
   * `!== true` from `enabled()` as "this match is disabled — fall through
   * to the next-best one." Returning `ActionDisabledReason.SelectionRequired`
   * here caused every drag-on-selected-body to silently lose to lower
   * specificity bindings (a shape tool's insert drag, inserting phantom
   * rects on every move attempt). The invoker self-guards
   * on empty selection by returning `{}`, so a static `true` is correct
   * for the dispatcher gate; the command-palette enabled signal will need
   * a deps-aware predicate when that surface is wired up.
   *
   * Phase 7 TODO (still standing): extend `Action.enabled` to accept a
   * deps snapshot so command-palette enabled state can be selection-aware
   * without breaking dispatcher routing.
   */
  enabled: () => true,
}, selectionLayer);
