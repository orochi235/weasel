import { useRef, useState, useCallback } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import type { MoveAdapter, SnapTarget } from '../../../core/adapters/types';
import { translateRectPose } from '../../../features/groups/composePose';
import { dispatchApplyBatch } from '../../../core/ops/applyOpsTo';
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
export interface UseMoveReturn<TPose> {
  start(args: MoveStartArgs): void;
  move(args: MoveMoveArgs): boolean;
  end(): void;
  cancel(): void;
  isActive(): boolean;
  overlay: MoveOverlay<TPose> | null;
}

/** Pointer-driven move interaction with composable behaviors (snap, container reparent, snap-back) and op-batched commit. */
export function useMove<TObject extends { id: string }, TPose>(
  adapter: MoveAdapter<TObject, TPose>,
  options: UseMoveOptions<TPose> = {},
): UseMoveReturn<TPose> {
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

  const stateRef = useRef<{
    phase: 'idle' | 'pending' | 'active';
    startWorld: { x: number; y: number };
    startClient: { x: number; y: number };
    ctx: GestureContext<TPose, TObject> | null;
    cascadeIds: string[];
    cascadeOriginWorld: Map<string, TPose>;
  }>({
    phase: 'idle',
    startWorld: { x: 0, y: 0 },
    startClient: { x: 0, y: 0 },
    ctx: null,
    cascadeIds: [],
    cascadeOriginWorld: new Map(),
  });

  const [overlay, setOverlay] = useState<MoveOverlay<TPose> | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current.phase = 'idle';
    stateRef.current.ctx = null;
    stateRef.current.cascadeIds = [];
    stateRef.current.cascadeOriginWorld = new Map();
    setOverlay(null);
  }, []);

  const start = useCallback((args: MoveStartArgs) => {
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
    };
  }, [adapter, expandIds, cascadeWorldPose]);

  const move = useCallback((args: MoveMoveArgs): boolean => {
    const s = stateRef.current;
    if (s.phase === 'idle' || !s.ctx) return false;

    if (s.phase === 'pending') {
      const dxs = args.clientX - s.startClient.x;
      const dys = args.clientY - s.startClient.y;
      if (dxs * dxs + dys * dys < dragThresholdPx * dragThresholdPx) return true;
      s.phase = 'active';
      onGestureStart?.(s.ctx.draggedIds);
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

    setOverlay({ draggedIds: ctx.draggedIds, poses: overlayPoses, snapped: snap, hideIds });
    return true;
  }, [adapter, dragThresholdPx, onGestureStart, translatePose]);

  const end = useCallback(() => {
    const s = stateRef.current;
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
  }, [adapter, cleanup, moveLabel, onGestureEnd]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEnd?.(false);
  }, [cleanup, onGestureEnd]);

  const isActive = useCallback(() => stateRef.current.phase === 'active', []);

  return { start, move, end, cancel, isActive, overlay };
}
