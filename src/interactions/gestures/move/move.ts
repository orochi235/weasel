import { useRef, useState, useCallback, useMemo } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import type { MoveAdapter, SnapTarget } from '../../../core/adapters/types';
import { translateRectPose } from '../../../features/groups/composePose';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { GestureContext, MoveBehavior, MoveOverlay, ModifierState } from '../types';

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
   *  virtual-group expansion (groups have no pose; their leaves do).
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

/** Return shape of `useMove`: lifecycle methods and a live overlay snapshot. */
export interface MoveController<TObject extends { id: string }, TPose> {
  start(args: MoveStartArgs): void;
  move(args: MoveMoveArgs): boolean;
  end(): void;
  cancel(): void;
  isActive(): boolean;
  overlay: MoveOverlay<TPose> | null;
  /** The adapter passed in. Exposed so downstream consumers (notably
   *  `<Canvas>`) can derive default `hitBody`/`boundsOf` without taking
   *  the adapter as a separate prop. */
  adapter: MoveAdapter<TObject, TPose>;
}

/** Pointer-driven move interaction with composable behaviors (snap, container reparent, snap-back) and op-batched commit. */
export function useMove<TObject extends { id: string }, TPose>(
  adapter: MoveAdapter<TObject, TPose>,
  options: UseMoveOptions<TPose> = {},
): MoveController<TObject, TPose> {
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

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  // Latest-value refs so controller methods can stay referentially stable
  // across renders even when the consumer passes inline callbacks/options.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const translatePoseRef = useRef(translatePose);
  translatePoseRef.current = translatePose;
  const dragThresholdPxRef = useRef(dragThresholdPx);
  dragThresholdPxRef.current = dragThresholdPx;
  const moveLabelRef = useRef(moveLabel);
  moveLabelRef.current = moveLabel;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;
  const expandIdsRef = useRef(expandIds);
  expandIdsRef.current = expandIds;
  const cascadeWorldPoseRef = useRef(cascadeWorldPose);
  cascadeWorldPoseRef.current = cascadeWorldPose;

  type LayoutPass = {
    destContainerId: string | null;
    accepted: boolean;
    layout: unknown; // LayoutStrategy<TPose>
    container: { id: string; bounds: { x: number; y: number; width: number; height: number } } | null;
    children: { id: string; pose: TPose }[];
    target: unknown; // DropTarget<TPose> | null
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

  const stateRef = useRef<{
    phase: 'idle' | 'pending' | 'active';
    startWorld: { x: number; y: number };
    startClient: { x: number; y: number };
    ctx: GestureContext<TPose, TObject> | null;
    cascadeIds: string[];
    cascadeOriginWorld: Map<string, TPose>;
    layoutPass: LayoutPass;
  }>({
    phase: 'idle',
    startWorld: { x: 0, y: 0 },
    startClient: { x: 0, y: 0 },
    ctx: null,
    cascadeIds: [],
    cascadeOriginWorld: new Map(),
    layoutPass: makeEmptyLayoutPass(),
  });

  const [overlay, setOverlay] = useState<MoveOverlay<TPose> | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current.phase = 'idle';
    stateRef.current.ctx = null;
    stateRef.current.cascadeIds = [];
    stateRef.current.cascadeOriginWorld = new Map();
    stateRef.current.layoutPass = makeEmptyLayoutPass();
    setOverlay(null);
  }, []);

  const start = useCallback((args: MoveStartArgs) => {
    const adapter = adapterRef.current;
    const expandIds = expandIdsRef.current;
    const cascadeWorldPose = cascadeWorldPoseRef.current;
    const ids = expandIds ? expandIds(args.ids) : args.ids;
    if (ids.length === 0) {
      stateRef.current.phase = 'idle';
      stateRef.current.ctx = null;
      return;
    }
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

    stateRef.current = {
      phase: 'pending',
      startWorld: { x: args.worldX, y: args.worldY },
      startClient: { x: args.clientX, y: args.clientY },
      cascadeIds,
      cascadeOriginWorld,
      ctx: {
        draggedIds: ids,
        origin,
        current: new Map(origin),
        snap: null,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
        pointer: { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
        adapter,
        scratch: {},
      },
      layoutPass: makeEmptyLayoutPass(),
    };
  }, []);

  const move = useCallback((args: MoveMoveArgs): boolean => {
    const s = stateRef.current;
    if (s.phase === 'idle' || !s.ctx) return false;
    const translatePose = translatePoseRef.current;

    if (s.phase === 'pending') {
      const dxs = args.clientX - s.startClient.x;
      const dys = args.clientY - s.startClient.y;
      const threshold = dragThresholdPxRef.current;
      if (dxs * dxs + dys * dys < threshold * threshold) return true;
      s.phase = 'active';
      onGestureStartRef.current?.(s.ctx.draggedIds);
      for (const b of behaviorsRef.current) b.onStart?.(s.ctx);
    }

    const ctx = s.ctx;
    ctx.modifiers = args.modifiers;
    ctx.pointer = { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY };

    const dx = args.worldX - s.startWorld.x;
    const dy = args.worldY - s.startWorld.y;

    const newPoses = new Map<string, TPose>();
    let snap: SnapTarget<TPose> | null = ctx.snap;

    for (const id of ctx.draggedIds) {
      const originPose = ctx.origin.get(id)!;
      let proposed = translatePose(originPose, dx, dy);
      // Behaviors run only against the primary id (first in the array).
      // For multi-select group drag, secondary ids share the same delta.
      if (id === ctx.draggedIds[0]) {
        for (const b of behaviorsRef.current) {
          const r = b.onMove?.(ctx, proposed);
          if (!r) continue;
          if (r.pose !== undefined) proposed = r.pose;
          if (r.snap !== undefined) snap = r.snap;
        }
      }
      newPoses.set(id, proposed);
    }

    ctx.current = newPoses;
    ctx.snap = snap;

    let overlayPoses = newPoses;
    let hideIds: string[] = ctx.draggedIds;
    if (s.cascadeIds.length > 0) {
      overlayPoses = new Map(newPoses);
      for (const id of s.cascadeIds) {
        const origin = s.cascadeOriginWorld.get(id)!;
        overlayPoses.set(id, translatePose(origin, dx, dy));
      }
      hideIds = [...ctx.draggedIds, ...s.cascadeIds];
    }

    // --- Layout pass (additive — runs only when adapter exposes getLayout) ---
    let hypotheticalChildPositions = new Map<string, TPose>();
    let sourceReflowPositions = new Map<string, TPose>();
    let destContainerId: string | null = null;
    let accepted = true;
    type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
    type Target = import('../../../layout/types').DropTarget<TPose>;
    let dest:
      | { id: string; bounds: { x: number; y: number; width: number; height: number }; layout: unknown }
      | null = null;
    let destLayout: Layout | null = null;
    let destChildren: { id: string; pose: TPose }[] = [];
    let destTarget: Target | null = null;

    const getLayout = (adapter as { getLayout?: (id: string) => unknown }).getLayout;
    if (typeof getLayout === 'function') {
      // Walk the parent chain from the deepest container under the pointer
      // up to the root, picking the top-most layout-bearing container.
      // We use bounding-box hit-test against every object that has a layout.
      const draggedId = ctx.draggedIds[0];
      const draggedPose = newPoses.get(draggedId)!;
      const sourceContainerId = adapter.getParent(draggedId);
      const draggedRect = draggedPose as unknown as { x: number; y: number; width: number; height: number };
      const draggedCenter = {
        x: draggedRect.x + (draggedRect.width ?? 0) / 2,
        y: draggedRect.y + (draggedRect.height ?? 0) / 2,
      };

      // Find the top-most container whose bounds contain the dragged center
      // AND has a non-null layout AND is not the dragged object itself.
      const candidates: { id: string; bounds: { x: number; y: number; width: number; height: number }; layout: unknown }[] = [];
      for (const obj of adapter.getObjects()) {
        if (obj.id === draggedId) continue;
        const layout = (getLayout as (id: string) => unknown).call(adapter, obj.id);
        if (!layout) continue;
        const bounds = adapter.getPose(obj.id) as unknown as { x: number; y: number; width: number; height: number };
        if (
          draggedCenter.x >= bounds.x &&
          draggedCenter.x < bounds.x + bounds.width &&
          draggedCenter.y >= bounds.y &&
          draggedCenter.y < bounds.y + bounds.height
        ) {
          candidates.push({ id: obj.id, bounds, layout });
        }
      }

      // "Top-most" = last one in iteration order (later siblings render on top).
      // This is a paint-order proxy — see docs/TODO.md "Deferred from container
      // layout strategies" for the real z-order walk we owe.
      dest = candidates[candidates.length - 1] ?? null;

      if (dest) {
        const layout = dest.layout as Layout;
        const childIds = adapter.getChildren?.(dest.id) ?? [];
        // Pass children INCLUDING dragged when same-container; layout
        // strategies (tileGrid) need pre-drop indexing. Filter when cross-
        // container — dragged isn't a child of dest yet.
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
        const target: Target | null = layout.snap.pickTarget(targets, { x: args.worldX, y: args.worldY });
        if (target === null) {
          // A null target from the layout's snap policy is its signal "I don't
          // accept here" — outside tolerance for snapPoint, no slot for tile
          // strategies. Treat as not-accepted regardless of how many targets
          // the strategy offered. Don't fall through to "drop anywhere"; that
          // undermines snapPoint-with-tolerance and free-space contracts.
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
          // Source reflow: if cross-container and the source has a layout,
          // ask the source layout for the positions of its children minus dragged.
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
              // Only emit poses that differ from current.
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

    stateRef.current.layoutPass = {
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
    return true;
  }, []);

  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const moveLabel = moveLabelRef.current;
    const onGestureEnd = onGestureEndRef.current;
    if (s.phase !== 'active' || !s.ctx) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const ctx = s.ctx;

    let ops: Op[] | null | undefined;
    for (const b of behaviorsRef.current) {
      const r = b.onEnd?.(ctx);
      if (r === undefined) continue;
      ops = r;
      break;
    }

    if (ops === null) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }

    const layoutPass = stateRef.current.layoutPass;
    if (
      ops === undefined &&
      layoutPass.layout &&
      layoutPass.container &&
      ctx.draggedIds.length === 1
    ) {
      type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
      type Target = import('../../../layout/types').DropTarget<TPose>;
      const layout = layoutPass.layout as Layout;
      const target = layoutPass.target as Target | null;
      const draggedId = ctx.draggedIds[0];
      const dropOps = layout.commitDrop(
        layoutPass.container,
        layoutPass.children,
        {
          id: draggedId,
          originPose: ctx.origin.get(draggedId)!,
          pose: ctx.current.get(draggedId)!,
          sourceContainerId: adapter.getParent(draggedId),
        },
        layoutPass.accepted ? target : null,
      );
      // Source-side reflow ops (cross-container case).
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
      ops = ctx.draggedIds.map((id) =>
        createTransformOp<TPose>({
          id,
          from: ctx.origin.get(id)!,
          to: ctx.current.get(id)!,
          label: moveLabel,
        }),
      );
    }

    if (ops.length > 0) {
      dispatchApplyBatch(adapter, ops, ops[0].label ?? moveLabel);
    }
    cleanup();
    onGestureEnd?.(true);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEndRef.current?.(false);
  }, [cleanup]);

  const isActive = useCallback(() => stateRef.current.phase === 'active', []);

  // Stable controller identity: reuse the same object across renders so
  // downstream consumers (notably `usePointerGestures`) don't rebuild their
  // pointer-event bindings — that rebind during a drag drops the browser's
  // implicit pointer capture and can race `lostpointercapture` ahead of
  // `pointerup`. `overlay` is exposed as a getter so readers always see the
  // current value despite the stable wrapper.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const controller = useMemo<MoveController<TObject, TPose>>(() => ({
    start, move, end, cancel, isActive,
    get overlay() { return overlayRef.current; },
    get adapter() { return adapterRef.current; },
  }), [start, move, end, cancel, isActive]);
  return controller;
}
