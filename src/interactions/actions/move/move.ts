import { useRef, useState, useCallback, useMemo } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { MoveAdapter, SnapTarget } from 'core/adapters/types';
import { translateRectPose } from 'features/groups/composePose';
import { dispatchApplyBatch } from 'core/applyOps';
import { useDragGesture } from '../../gestures/dragGesture';
import type { BehaviorResult, GestureContext, GroupTransform, MoveBehavior, MoveOverlay, ModifierState } from '../../gestures/types';
import { begin, hold, cancel as cancelResult, type Result } from '../../../tools/routing';
import type { ToolCtx } from '../../../tools/types';

/** Options for `useMove`. */
export interface UseMoveOptions<TPose> {
  /** How to apply a `(dx, dy)` translation to a pose. Defaults to
   *  `translateRectPose`, which assumes the pose carries top-level
   *  `x`/`y` (the common rect-shaped case). Override for non-rect poses
   *  (e.g. `Path` → `translatePath`). */
  translatePose?: (pose: TPose, dx: number, dy: number) => TPose;
  behaviors?: MoveBehavior<TPose>[];
  dragThresholdPx?: number;
  moveLabel?: string;
  /** Reserved for transient gestures (no history entry). Move is never transient
   *  in practice; accepted for API consistency but ignored. */
  transient?: boolean;
  onGestureStart?(ids: string[]): void;
  onGestureEnd?(committed: boolean): void;
  /** Optional: expand the incoming id list before pose lookups. Used for
   *  group expansion (groups have no pose; their leaves do).
   *  Called once at `start()`. The returned list flows through ctx,
   *  overlay (`overlay.draggedIds` is the **expanded** leaves), and op
   *  generation. Returning `[]` aborts the gesture cleanly.
   *  Default: identity. */
  expandIds?: (ids: string[]) => string[];
  /** Optional: lookup a world-space pose by id. When supplied alongside
   *  `adapter.getChildren`, the hook walks each dragged id's descendants and
   *  includes them in the live overlay (translated by the same drag delta
   *  and added to `overlay.hideIds`) so structurally-grouped children visually
   *  follow the parent during the gesture. No transform ops are generated
   *  for cascaded ids — under local-pose semantics, a child's local pose is
   *  unchanged when its parent's local pose moves, so the post-commit scene
   *  is already correct.
   *
   *  Pair with `worldPoseLookup(adapter, composeRectPose)` from
   *  `@orochi235/weasel/transforms` for the standard rect case. Returning
   *  `null` for an id (e.g., one removed mid-render) skips it. */
  cascadeWorldPose?: (id: string) => TPose | null;
}

/** Arguments passed to `start()` when initiating a move gesture. */
export interface MoveStartArgs {
  ids: string[];
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
}

/** Arguments passed to `move()` on each pointer-move during a live gesture. */
export interface MoveMoveArgs {
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
  modifiers: ModifierState;
}

/** Scratch type for `beginAt` continuations. */
/** @internal */
export interface MoveScratchTag {
  kind: 'move';
  ids: readonly string[];
}

/** Return shape of `useMove`: lifecycle methods and a live overlay snapshot. */
export interface MoveController<TNode extends { id: string }, TPose> {
  start(args: MoveStartArgs): void;
  move(args: MoveMoveArgs): boolean;
  end(): void;
  cancel(): void;
  isActive(): boolean;
  overlay: MoveOverlay<TPose> | null;
  /** The adapter passed in. Exposed so downstream consumers (notably
   *  `<Canvas>`) can derive default `pickEvery`/`boundsOf` without taking
   *  the adapter as a separate prop. */
  adapter: MoveAdapter<TNode, TPose>;
  /** Declarative-routing adapter. Calls `start()` immediately and returns a
   *  `begin` Result whose continuations delegate to `move`/`end`/`cancel`.
   *  Lets a route-table drag handler open this gesture without imperative
   *  dispatch. The scratch tag `{ kind: 'move', ids }` is passed through so
   *  the engaged phase can identify the gesture origin. */
  beginAt(ctx: ToolCtx<unknown>, ids: readonly string[]): Result<MoveScratchTag>;
}

/** Pointer-driven move interaction with composable behaviors (snap, container reparent, snap-back) and op-batched commit. */
export function useMove<TNode extends { id: string }, TPose>(
  adapter: MoveAdapter<TNode, TPose>,
  options: UseMoveOptions<TPose> = {},
): MoveController<TNode, TPose> {
  const {
    translatePose = translateRectPose as unknown as (pose: TPose, dx: number, dy: number) => TPose,
    behaviors = [],
    dragThresholdPx = 4,
    moveLabel = 'Move',
    onGestureStart,
    onGestureEnd,
    expandIds,
    cascadeWorldPose,
  } = options;

  const adapterRef = useRef(adapter); adapterRef.current = adapter;
  const behaviorsRef = useRef(behaviors); behaviorsRef.current = behaviors;
  const translatePoseRef = useRef(translatePose); translatePoseRef.current = translatePose;
  const dragThresholdPxRef = useRef(dragThresholdPx); dragThresholdPxRef.current = dragThresholdPx;
  const moveLabelRef = useRef(moveLabel); moveLabelRef.current = moveLabel;
  const onGestureStartRef = useRef(onGestureStart); onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd); onGestureEndRef.current = onGestureEnd;
  const expandIdsRef = useRef(expandIds); expandIdsRef.current = expandIds;

  const effectiveCascade = cascadeWorldPose
    ?? (adapter.getChildren ? (id: string) => {
      try { return adapter.getPose(id); } catch { return null; }
    } : undefined);
  const cascadeWorldPoseRef = useRef(effectiveCascade);
  cascadeWorldPoseRef.current = effectiveCascade;

  type LayoutPass = {
    destContainerId: string | null;
    accepted: boolean;
    layout: unknown;
    container: { id: string; bounds: { x: number; y: number; width: number; height: number } } | null;
    children: { id: string; pose: TPose }[];
    target: unknown;
    sourceReflowPositions: Map<string, TPose>;
  };
  const makeEmptyLayoutPass = (): LayoutPass => ({
    destContainerId: null,
    accepted: true,
    layout: null,
    container: null,
    children: [],
    target: null,
    sourceReflowPositions: new Map(),
  });

  interface MoveScratch {
    ids: string[];
    ctx: GestureContext<TPose, TNode> | null;
    cascadeIds: string[];
    cascadeOriginWorld: Map<string, TPose>;
    layoutPass: LayoutPass;
    startWorld: { x: number; y: number };
  }

  const [overlay, setOverlay] = useState<MoveOverlay<TPose> | null>(null);
  const overlayRef = useRef(overlay); overlayRef.current = overlay;

  const pendingArgsRef = useRef<{ args: MoveStartArgs; expandedIds: string[] } | null>(null);

  const doMoveCompute = useCallback((
    scratch: MoveScratch,
    moveArgs: MoveMoveArgs,
  ) => {
    const ctx = scratch.ctx;
    if (!ctx) return;
    const adapter = adapterRef.current;
    const translatePose = translatePoseRef.current;

    ctx.modifiers = moveArgs.modifiers;
    ctx.pointer = { worldX: moveArgs.worldX, worldY: moveArgs.worldY, clientX: moveArgs.clientX, clientY: moveArgs.clientY };

    const rawDx = moveArgs.worldX - scratch.startWorld.x;
    const rawDy = moveArgs.worldY - scratch.startWorld.y;

    let snap: SnapTarget<TPose> | null = ctx.snap;

    // The gesture proposes a uniform `GroupTransform` and behaviors shape it.
    // Applying the same transform to every dragged id eliminates the
    // multi-select drift the old "primary-pose + delta back-derivation"
    // path suffered: a snap-to-grid behavior used to move the primary onto
    // a grid line while secondaries kept the raw cursor delta, so the
    // selection slowly came apart over successive drags.
    let transform: GroupTransform = { kind: 'translate', dx: rawDx, dy: rawDy };
    const primaryId = ctx.draggedIds[0];
    const primaryOrigin = primaryId !== undefined ? ctx.origin.get(primaryId) : undefined;

    for (const b of behaviorsRef.current) {
      const r: BehaviorResult<TPose> | void = b.onMove?.(ctx, transform);
      if (!r) continue;
      if (r.transform !== undefined) {
        transform = r.transform;
      } else if (r.pose !== undefined && primaryId !== undefined && primaryOrigin !== undefined) {
        // Back-compat shim for legacy behaviors that still return a primary
        // `pose`. Derive a `translate` transform from the pose's `{x, y}`
        // diff against the primary's origin. Behaviors targeting non-rect
        // poses via the legacy channel and lacking `{x, y}` fall through
        // to the prior transform (raw delta) — matches pre-migration
        // behavior. New behaviors should return `transform` directly.
        if (transform.kind === 'translate') {
          const pp = r.pose as { x?: number; y?: number };
          const po = primaryOrigin as { x?: number; y?: number };
          let dx: number = transform.dx;
          let dy: number = transform.dy;
          if (typeof pp.x === 'number' && typeof po.x === 'number') dx = pp.x - po.x;
          if (typeof pp.y === 'number' && typeof po.y === 'number') dy = pp.y - po.y;
          transform = { kind: 'translate', dx, dy };
        }
      }
      if (r.snap !== undefined) snap = r.snap;
    }

    // Apply the (possibly shaped) transform uniformly to every dragged id.
    const newPoses = new Map<string, TPose>();
    const effectiveDx = transform.kind === 'translate' ? transform.dx : rawDx;
    const effectiveDy = transform.kind === 'translate' ? transform.dy : rawDy;
    for (const id of ctx.draggedIds) {
      const originPose = ctx.origin.get(id)!;
      newPoses.set(id, translatePose(originPose, effectiveDx, effectiveDy));
    }

    ctx.current = newPoses;
    ctx.snap = snap;

    let overlayPoses = newPoses;
    let hideIds: string[] = ctx.draggedIds;
    if (scratch.cascadeIds.length > 0) {
      overlayPoses = new Map(newPoses);
      for (const id of scratch.cascadeIds) {
        const origin = scratch.cascadeOriginWorld.get(id)!;
        overlayPoses.set(id, translatePose(origin, effectiveDx, effectiveDy));
      }
      hideIds = [...ctx.draggedIds, ...scratch.cascadeIds];
    }

    // --- Layout pass (additive — runs only when adapter exposes getLayout) ---
    let hypotheticalChildPositions = new Map<string, TPose>();
    let sourceReflowPositions = new Map<string, TPose>();
    let destContainerId: string | null = null;
    let accepted = true;
    type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
    type Target = import('../../../layout/types').DropTarget<TPose>;
    let dest:
      | { id: string; bounds: { x: number; y: number; width: number; height: number }; layout: Layout }
      | null = null;
    let destLayout: Layout | null = null;
    let destChildren: { id: string; pose: TPose }[] = [];
    let destTarget: Target | null = null;

    const getLayout = (adapter as { getLayout?: (id: string) => unknown }).getLayout;
    if (typeof getLayout === 'function') {
      const draggedId = ctx.draggedIds[0];
      const draggedPose = newPoses.get(draggedId)!;
      const sourceContainerId = adapter.getParent?.(draggedId) ?? null;
      const draggedRect = draggedPose as unknown as { x: number; y: number; width: number; height: number };
      const draggedCenter = {
        x: draggedRect.x + (draggedRect.width ?? 0) / 2,
        y: draggedRect.y + (draggedRect.height ?? 0) / 2,
      };

      type Candidate = {
        id: string;
        bounds: { x: number; y: number; width: number; height: number };
        layout: Layout;
        zPath: number[];
        depth: number;
      };
      const candidates: Candidate[] = [];

      const getChildren = (adapter as { getChildren?: (id: string | null) => string[] }).getChildren;
      const testInside = (cPose: TPose, layout: Layout): boolean => {
        if (layout.contains) return layout.contains(cPose, draggedCenter);
        const b = cPose as unknown as { x: number; y: number; width: number; height: number };
        return draggedCenter.x >= b.x && draggedCenter.x < b.x + b.width
          && draggedCenter.y >= b.y && draggedCenter.y < b.y + b.height;
      };
      const considerCandidate = (id: string, zPath: number[]) => {
        if (id === draggedId) return;
        const layout = (getLayout as (id: string) => Layout | null).call(adapter, id);
        if (!layout) return;
        const cPose = adapter.getPose(id);
        if (!testInside(cPose, layout)) return;
        const bounds = cPose as unknown as { x: number; y: number; width: number; height: number };
        candidates.push({ id, bounds, layout, zPath, depth: zPath.length });
      };

      if (typeof getChildren === 'function') {
        const visited = new Set<string>();
        const walk = (parentId: string | null, parentPath: number[]) => {
          const childIds = getChildren.call(adapter, parentId) ?? [];
          for (let i = 0; i < childIds.length; i++) {
            const childId = childIds[i];
            if (visited.has(childId)) continue;
            visited.add(childId);
            const childPath = [...parentPath, i];
            considerCandidate(childId, childPath);
            walk(childId, childPath);
          }
        };
        walk(null, []);
        const objs = adapter.getNodes();
        let rootIdx = (getChildren.call(adapter, null) ?? []).length;
        for (const obj of objs) {
          if (visited.has(obj.id)) continue;
          if ((adapter.getParent?.(obj.id) ?? null) !== null) continue;
          const path = [rootIdx++];
          visited.add(obj.id);
          considerCandidate(obj.id, path);
          walk(obj.id, path);
        }
      } else {
        const objs = adapter.getNodes();
        for (let i = 0; i < objs.length; i++) {
          considerCandidate(objs[i].id, [i]);
        }
      }

      dest = null;
      for (const c of candidates) {
        if (dest === null) {
          dest = c;
          continue;
        }
        const cur = dest as Candidate;
        if (c.depth > cur.depth) {
          dest = c;
          continue;
        }
        if (c.depth < cur.depth) continue;
        let cAfter = false;
        for (let i = 0; i < c.zPath.length; i++) {
          if (c.zPath[i] > cur.zPath[i]) { cAfter = true; break; }
          if (c.zPath[i] < cur.zPath[i]) { cAfter = false; break; }
        }
        if (cAfter) dest = c;
      }

      if (dest) {
        const layout = dest.layout as Layout;
        const childIds = adapter.getChildren?.(dest.id) ?? [];
        const children = childIds
          .filter((cid) => cid !== draggedId || sourceContainerId === dest!.id)
          .map((cid) => ({ id: cid, pose: adapter.getPose(cid) }));
        const draggedArg = {
          id: draggedId,
          originPose: ctx.origin.get(draggedId)!,
          pose: draggedPose,
          sourceContainerId,
        };
        const targets = layout.getDropTargets({ id: dest.id, bounds: dest.bounds }, children, draggedArg);
        const target: Target | null = layout.snap.pickTarget(targets, { x: moveArgs.worldX, y: moveArgs.worldY });
        if (target === null) {
          accepted = false;
        } else {
          destContainerId = dest.id;
          accepted = true;
          hypotheticalChildPositions = layout.reflowFor(
            { id: dest.id, bounds: dest.bounds },
            children,
            draggedArg,
            target,
          );
          if (sourceContainerId && sourceContainerId !== dest.id) {
            const srcLayout = (getLayout as (id: string) => unknown).call(
              adapter,
              sourceContainerId,
            ) as Layout | null;
            if (srcLayout) {
              const srcBounds = adapter.getPose(sourceContainerId) as unknown as {
                x: number; y: number; width: number; height: number;
              };
              const srcChildIds = adapter.getChildren?.(sourceContainerId) ?? [];
              const srcChildren = srcChildIds
                .filter((cid) => cid !== draggedId)
                .map((cid) => ({ id: cid, pose: adapter.getPose(cid) }));
              const reflowed = srcLayout.getChildPositions(
                { id: sourceContainerId, bounds: srcBounds },
                srcChildren,
              );
              for (const [cid, newPose] of reflowed) {
                const cur = adapter.getPose(cid) as unknown as Record<string, unknown>;
                const next = newPose as unknown as Record<string, unknown>;
                const same =
                  cur.x === next.x &&
                  cur.y === next.y &&
                  cur.width === next.width &&
                  cur.height === next.height;
                if (!same) sourceReflowPositions.set(cid, newPose);
              }
            }
          }
        }
        destLayout = layout;
        destChildren = children;
        destTarget = target;
      } else {
        accepted = false;
      }
    }

    scratch.layoutPass = {
      destContainerId,
      accepted,
      layout: dest ? destLayout : null,
      container: dest ? { id: dest.id, bounds: dest.bounds } : null,
      children: dest ? destChildren : [],
      target: destTarget,
      sourceReflowPositions,
    };

    setOverlay({
      draggedIds: ctx.draggedIds,
      poses: overlayPoses,
      snapped: snap,
      hideIds,
      hypotheticalChildPositions,
      sourceReflowPositions,
      destContainerId,
      accepted,
    });
  }, []);

  const gesture = useDragGesture<MoveScratch>({
    initScratch: () => {
      const args = pendingArgsRef.current!.args;
      return {
        ids: [],
        ctx: null,
        cascadeIds: [],
        cascadeOriginWorld: new Map(),
        layoutPass: makeEmptyLayoutPass(),
        startWorld: { x: args.worldX, y: args.worldY },
      };
    },
    thresholdReached: (ctx) => {
      // Use `!(d² < t²)` rather than `d² >= t²` so NaN inputs (jsdom
      // PointerEvent rarely propagates clientX/Y) activate immediately —
      // matches the pre-wrapper move's NaN-tolerant comparison.
      const dxs = ctx.current.clientX - ctx.start.clientX;
      const dys = ctx.current.clientY - ctx.start.clientY;
      const t = dragThresholdPxRef.current;
      return !(dxs * dxs + dys * dys < t * t);
    },
    onStart: (ctx) => {
      const adapter = adapterRef.current;
      const cascadeWorldPose = cascadeWorldPoseRef.current;
      const pending = pendingArgsRef.current!;
      const args = pending.args;
      const ids = pending.expandedIds;
      ctx.scratch.ids = ids;
      const origin = new Map<string, TPose>();
      for (const id of ids) origin.set(id, adapter.getPose(id));
      const cascadeIds: string[] = [];
      const cascadeOriginWorld = new Map<string, TPose>();
      if (cascadeWorldPose && adapter.getChildren) {
        const draggedSet = new Set(ids);
        const visited = new Set<string>(ids);
        const queue: string[] = [...ids];
        while (queue.length > 0) {
          const next = queue.shift()!;
          const children = adapter.getChildren(next);
          if (!children) continue;
          for (const childId of children) {
            if (visited.has(childId)) continue;
            visited.add(childId);
            queue.push(childId);
            if (draggedSet.has(childId)) continue;
            const w = cascadeWorldPose(childId);
            if (w === null) continue;
            cascadeIds.push(childId);
            cascadeOriginWorld.set(childId, w);
          }
        }
      }
      ctx.scratch.ctx = {
        draggedIds: ids,
        origin,
        current: new Map(origin),
        snap: null,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
        pointer: { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
        adapter,
        scratch: {},
      };
      ctx.scratch.cascadeIds = cascadeIds;
      ctx.scratch.cascadeOriginWorld = cascadeOriginWorld;
      ctx.scratch.layoutPass = makeEmptyLayoutPass();
      pendingArgsRef.current = null;
    },
    onActivate: (ctx) => {
      if (!ctx.scratch.ctx) return;
      onGestureStartRef.current?.(ctx.scratch.ctx.draggedIds);
      for (const b of behaviorsRef.current) b.onStart?.(ctx.scratch.ctx);
    },
    onMove: (ctx) => {
      if (!ctx.scratch.ctx) return;
      // Skip pre-threshold pending moves; doMoveCompute requires post-activation ctx.
      if (ctx.phase !== 'active') return;
      doMoveCompute(ctx.scratch, {
        worldX: ctx.current.worldX,
        worldY: ctx.current.worldY,
        clientX: ctx.current.clientX,
        clientY: ctx.current.clientY,
        modifiers: ctx.modifiers,
      });
    },
    onEnd: (ctx) => {
      const adapter = adapterRef.current;
      const moveLabel = moveLabelRef.current;
      if (!ctx.scratch.ctx || ctx.wasSubThreshold) {
        setOverlay(null);
        return false;
      }
      const moveCtx = ctx.scratch.ctx;
      let ops: Op[] | null | undefined;
      for (const b of behaviorsRef.current) {
        const r = b.onEnd?.(moveCtx);
        if (r === undefined) continue;
        ops = r;
        break;
      }
      if (ops === null) {
        setOverlay(null);
        return false;
      }
      const layoutPass = ctx.scratch.layoutPass;
      if (
        ops === undefined &&
        layoutPass.layout &&
        layoutPass.container &&
        moveCtx.draggedIds.length === 1
      ) {
        type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
        type Target = import('../../../layout/types').DropTarget<TPose>;
        const layout = layoutPass.layout as Layout;
        const target = layoutPass.target as Target | null;
        const draggedId = moveCtx.draggedIds[0];
        const dropOps = layout.commitDrop(
          layoutPass.container,
          layoutPass.children,
          {
            id: draggedId,
            originPose: moveCtx.origin.get(draggedId)!,
            pose: moveCtx.current.get(draggedId)!,
            sourceContainerId: adapter.getParent?.(draggedId) ?? null,
          },
          layoutPass.accepted ? target : null,
        );
        const sourceReflowOps: Op[] = [];
        for (const [cid, newPose] of layoutPass.sourceReflowPositions) {
          sourceReflowOps.push(
            createTransformOp<TPose>({
              id: cid,
              from: adapter.getPose(cid),
              to: newPose,
              label: 'Source reflow',
            }),
          );
        }
        ops = [...dropOps, ...sourceReflowOps];
      }
      if (ops === undefined) {
        ops = moveCtx.draggedIds.map((id) =>
          createTransformOp<TPose>({
            id,
            from: moveCtx.origin.get(id)!,
            to: moveCtx.current.get(id)!,
            label: moveLabel,
          }),
        );
      }
      if (ops.length > 0) {
        dispatchApplyBatch(adapter, ops, ops[0].label ?? moveLabel);
      }
      setOverlay(null);
      return true;
    },
    onCancel: () => {
      setOverlay(null);
    },
    onGestureEnd: (committed) => {
      onGestureEndRef.current?.(committed);
    },
  });

  const start = useCallback((args: MoveStartArgs) => {
    // Run expandIds once here so we can both early-return on [] (matching the
    // pre-wrapper "no gesture" behavior) and reuse the result in onStart.
    const expand = expandIdsRef.current;
    const expandedIds = expand ? expand(args.ids) : args.ids;
    if (expandedIds.length === 0) return;
    pendingArgsRef.current = { args, expandedIds };
    gesture.start(
      { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
      { alt: false, shift: false, meta: false, ctrl: false },
    );
  }, [gesture]);

  const move = useCallback((args: MoveMoveArgs): boolean => {
    return gesture.move(
      { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
      args.modifiers,
    );
  }, [gesture]);

  const isActive = useCallback(() => gesture.phase === 'active', [gesture]);

  const beginAt = useCallback((
    ctx: ToolCtx<unknown>,
    ids: readonly string[],
  ): Result<MoveScratchTag> => {
    start({
      ids: [...ids],
      worldX: ctx.worldX,
      worldY: ctx.worldY,
      clientX: ctx.screenPoint?.x ?? 0,
      clientY: ctx.screenPoint?.y ?? 0,
    });
    const tag: MoveScratchTag = { kind: 'move', ids };
    return begin<MoveScratchTag>({
      scratch: tag,
      onMove: (mCtx) => {
        move({
          worldX: mCtx.worldX,
          worldY: mCtx.worldY,
          clientX: mCtx.screenPoint?.x ?? 0,
          clientY: mCtx.screenPoint?.y ?? 0,
          modifiers: {
            alt:   mCtx.modifiers.alt,
            shift: mCtx.modifiers.shift,
            meta:  mCtx.modifiers.meta,
            ctrl:  mCtx.modifiers.ctrl,
          },
        });
        return hold(mCtx.scratch);
      },
      onRelease: () => {
        // useMove commits its own ops on end(); the routing engine exits
        // the engaged phase when we return cancel.
        gesture.end();
        return cancelResult();
      },
      onCancel: () => {
        gesture.cancel();
      },
    });
  }, [start, move, gesture]);

  return useMemo<MoveController<TNode, TPose>>(() => ({
    start,
    move,
    end: gesture.end,
    cancel: gesture.cancel,
    isActive,
    beginAt,
    get overlay() { return overlayRef.current; },
    get adapter() { return adapterRef.current; },
  }), [start, move, gesture.end, gesture.cancel, isActive, beginAt]);
}
