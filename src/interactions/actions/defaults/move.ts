/**
 * `moveAction` — first `ongoing`-timing Action descriptor.
 *
 * Mirrors the per-frame translate semantics of the `useMove` hook:
 *   - `start`: capture origin poses for all selected nodes; record the
 *     current drag delta in scratch each frame.
 *   - `onMove`: update the in-scratch `currentDelta` only — no scene writes.
 *     This avoids polluting the undo stack with O(N-frames) entries.
 *   - `onEnd('commit')`: apply the final delta via `scene.batch('Move', ...)`,
 *     which produces exactly one undo entry for the whole drag.
 *   - `onEnd('cancel')`: no scene writes — the scene was never mutated during
 *     the drag, so no restoration is needed.
 *
 * ## Why no per-frame scene writes
 *
 * `Scene.setPose` calls `executeAndLog` → `pushEntry`, which immediately
 * appends to the undo stack. Per-frame writes during drag would create
 * O(frames) history entries — matching `useMove`'s approach of tracking
 * poses only in React state (overlay) during the drag and committing a
 * single `createTransformOp` batch at the end.
 *
 * The behavior pipeline (snap-to-grid, snap-back-or-delete, snap-to-container,
 * etc.) via `opts.behaviors` from `BindingOpts` IS wired: `start` builds a
 * `GestureContext` + scene-backed adapter (`moveGestureAdapter`), `onMove`
 * folds each behavior's proposed-transform result, and `onEnd` runs a
 * first-non-undefined-wins reducer (`Op[]` commits via `scene.applyBatch`,
 * `null` aborts, all-`undefined` falls through to the default translate path).
 *
 * ## Pose generics
 *
 * `scene` dep is typed `Scene<unknown, string, unknown>` (the erased DepSchema
 * entry). Poses are read and written as `unknown`; `translatePoseGeneric`
 * delegates to `RECT_POSE_DESCRIPTOR.translate` which treats any pose as
 * `{x, y, ...}`. Consumers with non-rect poses should register a custom
 * action with a typed translatePose.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { resolveParams } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { Mat3 } from '@weasel-js/geom';
import { createTransformOp } from 'core/ops/transform';
import { createReparentOp } from 'core/ops/reparent';
import { geometryDataOp, type GeometryProjection } from '../geometryProjection';
import type { SelectionApi } from 'core/selection/useSelection';
import type { NodeAtPointDep, LayoutDep } from '../depSchema';
import type {
  LayoutStrategy,
  LayoutContainer,
  LayoutChild,
  DropTarget as LayoutDropTarget,
} from '../../../layout/types';
import { type PoseProjection } from '../resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from '../resize/autoPoseDescriptor';
import type { ResizePolicy } from '../depSchema';
import type { MoveBehavior, GroupTransform, GestureContext, BehaviorResult } from '../../gestures/types';
import { moveGestureAdapter, type MoveGestureAdapter } from '../move/gestureAdapter';
import {
  composeWorldPose,
  rebaseLocalPose,
  IDENTITY_POSE_COMPOSITION,
  type PoseAdapter,
  type PoseComposition,
  type RectPose,
} from 'features/groups/composePose';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Translate a pose by (dx, dy). Defers to the supplied projection's
 *  `translate` when present so non-rect poses (e.g. polygon Paths) move
 *  correctly; falls back to `AUTO_POSE_DESCRIPTOR.translate` so unwired
 *  Path consumers still drag correctly (AUTO dispatches per-call to the
 *  path or rect translator based on pose shape). */
function translatePoseGeneric(
  pose: unknown,
  dx: number,
  dy: number,
  projection?: PoseProjection<unknown>,
): unknown {
  const fn = projection?.translate ?? AUTO_POSE_DESCRIPTOR.translate;
  return (fn as (p: unknown, dx: number, dy: number) => unknown)(pose, dx, dy);
}

/** Drag-time layout pass. Walks containers for the deepest/topmost layout
 *  candidate under the dragged center, runs the strategy's snap, and folds
 *  destination + source reflow poses into `scratch.previews` (so they render
 *  as ghosts). Sets `scratch.layoutPass` when a
 *  container accepts. Single-select only — caller guards on `ids.length === 1`. */
function runLayoutPass(scratch: MoveScratch, moveCtx: InvocationCtx): void {
  const layoutDep = scratch.layout;
  if (!layoutDep || !moveCtx.drag) return;
  const scene = scratch.scene;
  const pc = scratch.pc as PoseComposition<RectPose>;
  const draggedId = scratch.ids[0];
  const poseAdapter = scenePoseAdapter(scene);
  if (!scene.get(draggedId)) return;
  const sourceContainerId = scene.get(draggedId)?.parent ?? null;
  const { dx, dy } = scratch.currentDelta;
  // Dragged preview in WORLD: compose the committed start pose up the parent
  // chain, then add the world drag delta (same math as `applyReparent`). The
  // LayoutStrategy contract is world-framed, so every pose handed to it below
  // is composed to world; reflow results are rebased back to local.
  const startWorld = composeWorldPose(poseAdapter, draggedId as string, pc.compose);
  const draggedWorld: RectPose = { ...startWorld, x: startWorld.x + dx, y: startWorld.y + dy };
  const draggedCenter = {
    x: draggedWorld.x + (draggedWorld.width ?? 0) / 2,
    y: draggedWorld.y + (draggedWorld.height ?? 0) / 2,
  };

  type Layout = LayoutStrategy<unknown>;
  interface Candidate {
    id: NodeId;
    bounds: { x: number; y: number; width: number; height: number };
    layout: Layout;
    zPath: number[];
    depth: number;
  }
  const candidates: Candidate[] = [];
  const testInside = (cPose: unknown, layout: Layout): boolean => {
    if (layout.contains) return layout.contains(cPose, draggedCenter);
    const b = cPose as { x: number; y: number; width: number; height: number };
    return draggedCenter.x >= b.x && draggedCenter.x < b.x + b.width
      && draggedCenter.y >= b.y && draggedCenter.y < b.y + b.height;
  };
  const consider = (id: NodeId, zPath: number[]): void => {
    if (id === draggedId) return;
    const layout = layoutDep.getLayout(id as string);
    if (!layout) return;
    const node = scene.get(id);
    if (!node) return;
    const worldBounds = composeWorldPose(poseAdapter, id as string, pc.compose);
    if (!testInside(worldBounds, layout)) return;
    candidates.push({
      id,
      bounds: worldBounds as { x: number; y: number; width: number; height: number },
      layout,
      zPath,
      depth: zPath.length,
    });
  };
  const walk = (parentId: NodeId | null, parentPath: number[]): void => {
    const childIds = parentId === null ? scene.roots : scene.childrenOf(parentId);
    for (let i = 0; i < childIds.length; i++) {
      const childPath = [...parentPath, i];
      consider(childIds[i], childPath);
      walk(childIds[i], childPath);
    }
  };
  walk(null, []);

  // Deepest wins; sibling-index path breaks ties (higher z = later index).
  let dest: Candidate | null = null;
  for (const c of candidates) {
    if (dest === null) { dest = c; continue; }
    if (c.depth > dest.depth) { dest = c; continue; }
    if (c.depth < dest.depth) continue;
    let cAfter = false;
    for (let i = 0; i < c.zPath.length; i++) {
      if (c.zPath[i] > dest.zPath[i]) { cAfter = true; break; }
      if (c.zPath[i] < dest.zPath[i]) { cAfter = false; break; }
    }
    if (cAfter) dest = c;
  }
  if (!dest) return;

  const layout = dest.layout;
  const container: LayoutContainer = { id: dest.id as string, bounds: dest.bounds };
  const children: LayoutChild<unknown>[] = scene.childrenOf(dest.id)
    .filter((cid) => cid !== draggedId || sourceContainerId === (dest!.id as string))
    .map((cid) => ({
      id: cid as string,
      pose: composeWorldPose(poseAdapter, cid as string, pc.compose),
    }));
  const draggedArg = {
    id: draggedId as string,
    originPose: startWorld,
    pose: draggedWorld,
    sourceContainerId,
  };
  const targets = layout.getDropTargets(container, children, draggedArg);
  const target = layout.snap.pickTarget(targets, { x: moveCtx.drag.current.x, y: moveCtx.drag.current.y });
  if (!target) return; // not accepted

  // Destination reflow → fold into previews (skip the dragged id itself).
  // `reflowPoses` returns world; previews are local, so rebase to the child's
  // current parent frame first.
  for (const [cid, pose] of layout.reflowPoses(container, children, draggedArg, target)) {
    if (asNodeId(cid) === draggedId) continue;
    const parent = scene.get(asNodeId(cid))?.parent ?? null;
    const local = rebaseLocalPose(poseAdapter, pose as RectPose, parent, pc.compose, pc.decompose);
    scratch.previews.set(asNodeId(cid), local);
  }

  // Source reflow (cross-container) → fold changed leftovers into previews.
  const sourceReflow = new Map<string, unknown>();
  if (sourceContainerId && sourceContainerId !== (dest.id as string)) {
    const srcLayout = layoutDep.getLayout(sourceContainerId);
    const srcNode = scene.get(asNodeId(sourceContainerId));
    if (srcLayout && srcNode) {
      const srcContainer: LayoutContainer = {
        id: sourceContainerId,
        bounds: composeWorldPose(poseAdapter, sourceContainerId, pc.compose) as { x: number; y: number; width: number; height: number },
      };
      const srcChildren: LayoutChild<unknown>[] = scene.childrenOf(asNodeId(sourceContainerId))
        .filter((cid) => cid !== draggedId)
        .map((cid) => ({
          id: cid as string,
          pose: composeWorldPose(poseAdapter, cid as string, pc.compose),
        }));
      for (const [cid, pose] of srcLayout.childPoses(srcContainer, srcChildren)) {
        const cur = composeWorldPose(poseAdapter, cid, pc.compose) as unknown as Record<string, unknown>;
        const next = pose as Record<string, unknown>;
        const same = cur.x === next.x && cur.y === next.y
          && cur.width === next.width && cur.height === next.height;
        if (same) continue;
        sourceReflow.set(cid, pose); // WORLD — rebased at each consumption point
        const parent = scene.get(asNodeId(cid))?.parent ?? null;
        scratch.previews.set(asNodeId(cid), rebaseLocalPose(poseAdapter, pose as RectPose, parent, pc.compose, pc.decompose));
      }
    }
  }

  scratch.layoutPass = { layout, container, children, target, sourceReflow };
}

/** Allowed values for the `reparentOnDrop` binding param. `'off'` (the
 *  default) preserves the legacy translate-only commit. `'top'` lands the
 *  moved node at the top of the container under the cursor. `'above'`
 *  lands it immediately above the hit sibling in z-order (falls back to
 *  `'top'` semantics when the hit is itself a container or when the hit
 *  and moved node share no parent). */
export type ReparentOnDrop = 'off' | 'top' | 'above';

/** Build a `PoseAdapter` over a `Scene` for `composePose` helpers.
 *  `getParent` returns the live parent at call time so mid-batch
 *  parent updates compose correctly. */
function scenePoseAdapter(
  scene: Scene<unknown, string, unknown>,
): PoseAdapter<RectPose> {
  return {
    getPose: (id) => scene.get(id as NodeId)!.pose as RectPose,
    getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
  };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

/** Resolved layout drop for the latest onMove frame. Only set when a layout
 *  container accepted the drag (non-null snap target), single-select. */
interface LayoutPass {
  layout: LayoutStrategy<unknown>;
  container: LayoutContainer;
  children: LayoutChild<unknown>[];
  target: LayoutDropTarget<unknown>;
  /** Source-container leftovers that actually moved (id → new pose). */
  sourceReflow: Map<string, unknown>;
}

interface MoveScratch {
  /** Origin poses captured at drag start. Key is NodeId. Includes both
   *  selected roots AND their descendant ids — when a container moves, the
   *  preview-ghost layer needs every child's pose to render the subtree at
   *  the previewed location (clipped to the container silhouette). */
  startPoses: Map<NodeId, unknown>;
  /** Selected ids only — the roots whose pose actually changes at commit.
   *  Descendants follow implicitly under local-pose semantics (a child's
   *  local pose is unchanged when its parent's local pose moves), so we
   *  do NOT write descendant poses to scene at commit. */
  ids: NodeId[];
  /** Descendant ids cascaded for preview only. Their preview poses are
   *  computed each frame so container drags show children moving along. */
  cascadeIds: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Running drag delta — updated each onMove, applied once at commit. */
  currentDelta: { dx: number; dy: number };
  /** In-flight preview poses keyed by node id (roots + cascaded children).
   *  Populated on onMove; cleared on onEnd. Read by `previewIds`/`previewPose`. */
  previews: Map<NodeId, unknown>;
  /** Pose projection captured at drag start. Used by `translatePoseGeneric`
   *  so non-rect poses (e.g. polygon Paths) translate via the consumer's
   *  descriptor instead of the rect-pose default. Undefined when the
   *  `resizePolicy` dep wasn't sourced. */
  projection?: PoseProjection<unknown>;
  /** Behaviors from `opts.behaviors`; empty array when none supplied. */
  behaviors: MoveBehavior<unknown>[];
  /** Reused gesture context handed to behaviors across the drag. */
  gestureCtx: GestureContext<unknown>;
  /** Scene-backed adapter the committed behavior ops apply through. */
  adapter: MoveGestureAdapter<unknown>;
  /** Layout dep captured at start; undefined when not registered. */
  layout: LayoutDep | undefined;
  /** Latest resolved layout pass, or null when no container accepted. */
  layoutPass: LayoutPass | null;
  /** Pose-composition strategy captured at gesture start. Defaults to
   *  IDENTITY (absolute-pose) when the `poseComposition` dep is absent;
   *  local-pose consumers supply composeRectPose/decomposeRectPose. */
  pc: PoseComposition<unknown>;
  /** Optional consumer commit hook captured at gesture start. When present,
   *  ops-based commits route through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
  /** Optional eager-sync seam captured at gesture start. When present, the
   *  translate-only commit path emits a `setData` op per moved node mapping
   *  its data-held geometry by the (dx,dy) translation. Undefined → pose-only. */
  geometryProjection?: GeometryProjection;
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
  const dep = endCtx.deps['nodeAtPoint'] as NodeAtPointDep | undefined;
  if (!dep) return null;

  // Exclude moved roots + their descendants. Otherwise we'd happily
  // reparent a node into itself (or under one of its own children).
  const exclude = new Set<NodeId>([...scratch.ids, ...scratch.cascadeIds]);
  const hit = dep(endCtx.world, exclude);
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
  pc: PoseComposition<RectPose>,
): void {
  const scene = scratch.scene;
  const poseAdapter = scenePoseAdapter(scene);

  for (const id of scratch.ids) {
    if (!scratch.startPoses.has(id)) continue;

    // World pose the user dragged the node to. `composeWorldPose` folds
    // ancestor offsets in for nested nodes; for top-level nodes it
    // collapses to the local pose. The drag delta is in world space, so
    // it adds in directly. Reads from the current scene state, which is
    // unchanged from drag start because `moveAction` doesn't write
    // during `onMove`.
    const startWorld = composeWorldPose(poseAdapter, id, pc.compose);
    const draggedWorld: RectPose = {
      ...startWorld,
      x: startWorld.x + dx,
      y: startWorld.y + dy,
    };
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
 *
 * @see useMove — the React hook this descriptor mirrors for the simple case.
 */
export const moveAction: Action & { requires: string[] } = {
  id: 'move',
  label: 'Move',
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
  requires: ['selection', 'scene', 'resizePolicy', 'layout', 'applyOps', 'poseComposition'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;
      // `resizePolicy` is the shared pose-projection dep — moveAction reads
      // its `projection.translate` so non-rect poses (polygon Paths, etc.)
      // translate via the consumer's descriptor instead of silently
      // falling back to the rect-pose `{x, y, width, height}` default.
      const policy = ctx.deps.resizePolicy as ResizePolicy<unknown> | undefined;
      const projection = policy?.projection;
      const layout = ctx.deps.layout as LayoutDep | undefined;
      const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      const geometryProjection = ctx.deps.geometryProjection as GeometryProjection | undefined;
      // Pose-composition strategy: how the consumer's scene folds local poses
      // up to world (and back). Absent → IDENTITY (absolute-pose: nodes store
      // world coords, parents are grouping-only). Local-pose consumers supply
      // { compose: composeRectPose, decompose: decomposeRectPose }.
      const pc = (ctx.deps.poseComposition as PoseComposition<unknown> | undefined)
        ?? IDENTITY_POSE_COMPOSITION;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start. Walk descendants so
      // container drags can preview every displaced child — required by
      // `usePreviewGhostLayer.buildSubtree` which only recurses into ids
      // present in `previewIds()`.
      const startPoses = new Map<NodeId, unknown>();
      const cascadeIds: NodeId[] = [];
      const seen = new Set<NodeId>();
      const queue: NodeId[] = [];
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        startPoses.set(id, node.pose);
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
          startPoses.set(childId, childNode.pose);
          cascadeIds.push(childId);
          queue.push(childId);
        }
      }

      const behaviors = (opts?.behaviors ?? []) as MoveBehavior<unknown>[];
      const adapter = moveGestureAdapter<unknown>(scene as Scene<unknown, string, unknown>);
      const origin = new Map<string, unknown>();
      for (const [id, pose] of startPoses) origin.set(id as string, pose);
      const gestureCtx: GestureContext<unknown> = {
        draggedIds: ids as unknown as string[],
        origin,
        current: new Map(origin),
        snap: null,
        modifiers: { ...ctx.modifiers },
        pointer: { worldX: ctx.world.x, worldY: ctx.world.y, clientX: 0, clientY: 0 },
        adapter: adapter as unknown as GestureContext<unknown>['adapter'],
        scratch: {},
      };
      for (const b of behaviors) b.onStart?.(gestureCtx);

      const scratch: MoveScratch = {
        startPoses,
        ids,
        cascadeIds,
        scene,
        currentDelta: { dx: 0, dy: 0 },
        previews: new Map<NodeId, unknown>(),
        projection,
        behaviors,
        gestureCtx,
        adapter,
        layout,
        layoutPass: null,
        pc,
        applyOps,
        geometryProjection,
      };

      return {
        kind: 'move',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          let dx = moveCtx.drag.delta.x;
          let dy = moveCtx.drag.delta.y;

          if (scratch.behaviors.length > 0) {
            const gctx = scratch.gestureCtx;
            gctx.modifiers = { ...moveCtx.modifiers };
            gctx.pointer = { worldX: moveCtx.drag.current.x, worldY: moveCtx.drag.current.y, clientX: 0, clientY: 0 };
            // `current` is pre-populated from the raw cursor delta BEFORE
            // any behavior shapes `transform`. Unlike `onEnd`, it is NOT
            // refreshed after each behavior runs — so onMove behaviors
            // should derive position from `origin` + the `proposed`
            // GroupTransform arg, NOT from `ctx.current` (which reflects
            // the unmodified delta at this frame's start).
            for (const [id, ori] of scratch.startPoses) {
              gctx.current.set(id as string, translatePoseGeneric(ori, dx, dy, scratch.projection));
            }
            let transform: GroupTransform = { kind: 'translate', dx, dy };
            const primary = scratch.ids[0] as NodeId | undefined;
            for (const b of scratch.behaviors) {
              const r: BehaviorResult<unknown> | void = b.onMove?.(gctx, transform);
              if (!r) continue;
              if (r.transform && r.transform.kind === 'translate') {
                transform = r.transform;
              } else if (r.pose !== undefined && primary !== undefined) {
                const o = scratch.startPoses.get(primary) as { x: number; y: number } | undefined;
                const p = r.pose as unknown as { x: number; y: number };
                if (o) transform = { kind: 'translate', dx: p.x - o.x, dy: p.y - o.y };
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
            scratch.previews.set(id, translatePoseGeneric(ori, dx, dy, scratch.projection));
          }

          // Layout reflow pass — single-select only; no-op without a layout dep.
          scratch.layoutPass = null;
          if (scratch.ids.length === 1) runLayoutPass(scratch, moveCtx);
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            // Scene was never mutated during drag; nothing to restore.
            scratch.previews.clear();
            return;
          }
          // 'commit': apply final delta as a single batch → one undo entry.
          const { dx, dy } = scratch.currentDelta;

          // Route ops-based commits through the consumer hook when present
          // (so an app with its own history captures the gesture as one undo
          // entry); otherwise commit straight to the scene's own history.
          const commitOps = (ops: Op[], label: string): void => {
            if (scratch.applyOps) scratch.applyOps(ops, label);
            else scratch.scene.applyBatch(ops, label, scratch.adapter);
          };

          // Behavior pipeline owns the commit if any behavior returns non-undefined.
          if (scratch.behaviors.length > 0) {
            const gctx = scratch.gestureCtx;
            for (const [id, ori] of scratch.startPoses) {
              gctx.current.set(id as string, translatePoseGeneric(ori, dx, dy, scratch.projection));
            }
            for (const b of scratch.behaviors) {
              const r = b.onEnd?.(gctx);
              if (r === undefined) continue;        // defer to next behavior / default
              if (r === null) {                     // abort (e.g. snap-back)
                scratch.previews.clear();
                return;
              }
              // Three-way contract: undefined = defer to next behavior (or
              // default translate). null = abort (snap-back / delete). Op[]
              // = claim the gesture and commit those ops — even an EMPTY
              // array [] claims the commit and suppresses the default
              // translate (behavior intentionally committed nothing).
              commitOps(r, 'Move');
              scratch.previews.clear();
              return;
            }
            // all behaviors deferred → fall through to the default path below.
          }

          // No-op if no movement (sub-threshold drag or zero delta).
          if (dx === 0 && dy === 0) {
            scratch.previews.clear();
            return;
          }

          // Layout drop commit — takes precedence over reparent-on-drop when a
          // layout container accepted the drag this gesture (single-select).
          // TODO: geometryProjection for drop-reflow — left pose-only because the
          // reflow distributes per-child poses with no single global delta; not
          // exercised by the geometry contract gate.
          if (scratch.layout && scratch.ids.length === 1 && scratch.layoutPass) {
            const lp = scratch.layoutPass;
            const pc = scratch.pc as PoseComposition<RectPose>;
            const draggedId = scratch.ids[0];
            const commitAdapter = scenePoseAdapter(scratch.scene);
            const startWorld = composeWorldPose(commitAdapter, draggedId as string, pc.compose);
            const sourceContainerId = scratch.scene.get(draggedId)?.parent ?? null;
            const draggedArg = {
              id: draggedId as string,
              originPose: startWorld,
              pose: { ...startWorld, x: startWorld.x + dx, y: startWorld.y + dy } as RectPose,
              sourceContainerId,
            };
            const destId = lp.container.id;
            // commitDrop returns world poses (the contract is world in/out).
            // Rebase each transform op to local: the dragged id lands under the
            // destination container; any other id keeps its current parent.
            // `from` rebases under the node's PRE-commit parent.
            const rebaseOpToLocal = (op: Op): Op => {
              if (op.name !== 'transform') return op;
              const a = op.args as { id: string; from: RectPose; to: RectPose; label?: string; coalesceKey?: string };
              const curParent = scratch.scene.get(asNodeId(a.id))?.parent ?? null;
              const toParent = a.id === (draggedId as string) ? destId : curParent;
              return createTransformOp<RectPose>({
                id: a.id,
                from: rebaseLocalPose(commitAdapter, a.from, curParent, pc.compose, pc.decompose),
                to: rebaseLocalPose(commitAdapter, a.to, toParent, pc.compose, pc.decompose),
                label: a.label,
                coalesceKey: a.coalesceKey,
              });
            };
            const dropOps = lp.layout.commitDrop(lp.container, lp.children, draggedArg, lp.target).map(rebaseOpToLocal);
            // Cross-container drop: reparent the dragged node under the
            // destination container so its tree position matches its new
            // visual home. Scene v1's absolute-pose semantics mean the
            // subsequent pose op still lands the child at the snapped cell.
            const reparentOps: Op[] = [];
            if (draggedArg.sourceContainerId !== destId) {
              reparentOps.push(createReparentOp({
                id: draggedId as string,
                fromParentId: draggedArg.sourceContainerId,
                toParentId: destId,
                label: 'Reparent',
              }));
            }
            const reflowOps: Op[] = [];
            for (const [cid, worldPose] of lp.sourceReflow) {
              const parent = scratch.scene.get(asNodeId(cid))?.parent ?? null;
              // Source-reflow siblings keep their parent, so `from` is already
              // the live local pose (no rebase); only `to` (a world pose stored
              // in `lp.sourceReflow`) is rebased to local. This is the
              // intentional counterpart to the dropOps rebaser above, where
              // `from` comes from a world `commitDrop` op and so does rebase.
              reflowOps.push(createTransformOp<RectPose>({
                id: cid,
                from: scratch.scene.get(asNodeId(cid))!.pose as RectPose,
                to: rebaseLocalPose(commitAdapter, worldPose as RectPose, parent, pc.compose, pc.decompose),
                label: 'Source reflow',
              }));
            }
            const ops = [...reparentOps, ...dropOps, ...reflowOps];
            if (ops.length > 0) {
              commitOps(ops, ops[0].label ?? 'Move');
            }
            scratch.previews.clear();
            return;
          }

          // Reparent-on-drop, when opted in via `opts.params.reparentOnDrop`.
          // Resolves the drop target via the `nodeAtPoint` dep (sourced by
          // `<SceneCanvas>`) and reparents each moved root under it, then
          // writes the translated pose in the new parent's frame so the
          // visual position is preserved across the parent swap.
          const resolved = resolveParams(opts?.params);
          const reparentMode = ((resolved?.['reparentOnDrop'] as ReparentOnDrop | undefined) ?? 'off');
          const dropTarget = reparentMode !== 'off'
            ? resolveDropTarget(endCtx, scratch)
            : null;

          if (dropTarget) {
            // Reparent-on-drop still commits directly to the scene. Routing
            // this path through `commitOps` is a separate later task.
            scratch.scene.batch('Move', () => {
              applyReparent(scratch, dropTarget, reparentMode, dx, dy, scratch.pc as PoseComposition<RectPose>);
            });
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
            const m: Mat3 = [1, 0, 0, 1, dx, dy];
            const ops: Op[] = [];
            for (const id of [...scratch.ids, ...scratch.cascadeIds]) {
              const origin = scratch.startPoses.get(id);
              if (origin === undefined) continue;
              ops.push(createTransformOp<unknown>({
                id: id as string,
                from: origin,
                to: translatePoseGeneric(origin, dx, dy, scratch.projection),
                label: 'Move',
              }));
              if (scratch.geometryProjection) {
                const node = scratch.scene.get(id);
                if (node) {
                  const dataOp = geometryDataOp(
                    scratch.geometryProjection,
                    { id: id as string, data: node.data, pose: origin },
                    m,
                    'Move',
                  );
                  if (dataOp) ops.push(dataOp);
                }
              }
            }
            if (ops.length > 0) commitOps(ops, 'Move');
          }
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  /**
   * Always enabled at the descriptor level. The dispatcher's
   * specificity-fallthrough loop (`dispatcher.ts`) treats anything
   * `!== true` from `enabled()` as "this match is disabled — fall through
   * to the next-best one." Returning `ActionDisabledReason.SelectionRequired`
   * here caused every drag-on-selected-body to silently lose to lower
   * specificity ambient bindings (notably `insertAction`'s bare drag),
   * inserting phantom rects on every move attempt. The invoker self-guards
   * on empty selection by returning `{}`, so a static `true` is correct
   * for the dispatcher gate; the command-palette enabled signal will need
   * a deps-aware predicate when that surface is wired up.
   *
   * Phase 7 TODO (still standing): extend `Action.enabled` to accept a
   * deps snapshot so command-palette enabled state can be selection-aware
   * without breaking dispatcher routing.
   */
  enabled: () => true,
};
