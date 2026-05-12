import { useMemo, useRef } from 'react';
import { createInsertOp } from 'core/ops/create';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { InsertAdapter } from 'core/adapters/types';
import type {
  GestureContext,
  InsertBehavior,
  InsertOverlay,
  InsertPoint,
  ModifierState,
  ResizePose,
} from '../types';
import { useDragRect, type DragRectCtx } from '../dragRect';

/** Options for `useInsert`. */
export interface UseInsertOptions<TPose, TNode extends { id: string } = { id: string }> {
  behaviors?: InsertBehavior<TPose>[];
  insertLabel?: string;
  /** Reserved; insert is never transient in practice. Ignored. */
  transient?: boolean;
  /** Strictly-greater-than thresholds; bounds with width <= or height <= abort. Default { width: 0, height: 0 }. */
  minBounds?: { width: number; height: number };
  /** Construct the in-flight pose from the drag bounds. Defaults to the
   *  identity cast (treat bounds as TPose). Override for non-rect TPose
   *  (e.g. `(b) => rectPath(b)` or a polygon factory). */
  posefromBounds?: (bounds: ResizePose) => TPose;
  /** Click / sub-threshold-drag fallback. When provided, a release whose
   *  bounds fall <= minBounds calls `pointInsert(start)` instead of aborting.
   *  Returning null aborts. The created object is dispatched as an InsertOp
   *  under the same `insertLabel`. */
  pointInsert?: (point: { x: number; y: number }) => TNode | null;
  /** Drag-disabled mode. When true, every release routes to pointInsert(start)
   *  regardless of bounds — commitInsert is never called. Used by tool hooks
   *  that wire only pointer.onClick (no marquee). */
  clickOnly?: boolean;
  /** Override for op dispatch on commit. When set, this is called instead of
   *  `dispatchApplyBatch(adapter, ...)`. Tool hooks that synthesize an adapter
   *  but want commits to route through the active tool ctx's `applyOps`
   *  (for history integration) supply a function that reads from a ref
   *  captured on handler entry. Read fresh on every commit, so a ref-reader
   *  works without retriggering memos. */
  applyOps?: (ops: Op[], label: string) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

/** Return shape of `useInsert`: lifecycle methods plus the live drag-rectangle overlay. */
export interface InsertController<TNode extends { id: string }, TPose> {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isInserting: boolean;
  overlay: InsertOverlay<TPose> | null;
  /** The adapter passed in. Exposed so `<Canvas>` can derive defaults. */
  adapter: InsertAdapter<TNode>;
  /** True iff `pointInsert` was supplied. */
  readonly supportsPointInsert: boolean;
  /** True iff a non-clickOnly path is wired (drag commits will reach
   *  `adapter.commitInsert`). False when `clickOnly: true`. */
  readonly supportsCommitInsert: boolean;
}

const GID = 'gesture';

/** Drag-rectangle insert interaction; the adapter materializes the new object on commit. */
export function useInsert<TNode extends { id: string }, TPose>(
  adapter: InsertAdapter<TNode>,
  options: UseInsertOptions<TPose, TNode> = {},
): InsertController<TNode, TPose> {
  const {
    behaviors = [],
    insertLabel = 'Insert',
    minBounds = { width: 0, height: 0 },
    posefromBounds = (b) => b as unknown as TPose,
    pointInsert,
    clickOnly = false,
    applyOps,
    onGestureStart,
    onGestureEnd,
  } = options;

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const posefromBoundsRef = useRef(posefromBounds);
  posefromBoundsRef.current = posefromBounds;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const insertLabelRef = useRef(insertLabel);
  insertLabelRef.current = insertLabel;
  const pointInsertRef = useRef(pointInsert);
  pointInsertRef.current = pointInsert;
  const clickOnlyRef = useRef(clickOnly);
  clickOnlyRef.current = clickOnly;
  const applyOpsOptionRef = useRef(applyOps);
  applyOpsOptionRef.current = applyOps;

  // Bridge: build a behavior-style GestureContext on demand from the dragRect ctx.
  const buildGestureCtx = (drCtx: DragRectCtx<unknown>): GestureContext<TPose> => {
    const startPoint: InsertPoint = drCtx.start;
    return {
      draggedIds: [GID],
      origin: new Map([[GID, startPoint as unknown as TPose]]),
      current: new Map([[GID, drCtx.current as unknown as TPose]]),
      snap: null,
      modifiers: drCtx.modifiers,
      pointer: { worldX: drCtx.current.x, worldY: drCtx.current.y, clientX: 0, clientY: 0 },
      adapter: adapterRef.current as unknown as GestureContext<TPose>['adapter'],
      scratch: {},
    };
  };

  const dr = useDragRect({
    minBounds,
    onStart: (ctx) => {
      const gctx = buildGestureCtx(ctx);
      for (const b of behaviorsRef.current) b.onStart?.(gctx);
      // Behaviors may mutate ctx.origin in onStart (e.g. snapToGrid rounds the
      // start point). Reflect any change back into dragRect's start.
      const mutated = gctx.origin.get(GID) as unknown as InsertPoint | undefined;
      if (mutated && (mutated.x !== ctx.start.x || mutated.y !== ctx.start.y)) {
        ctx.setStart(mutated);
        // At gesture-start current === start; keep them consistent so the
        // overlay's initial current reflects the snapped point.
        ctx.setCurrent(mutated);
      }
    },
    onMove: (ctx) => {
      const gctx = buildGestureCtx(ctx);
      for (const b of behaviorsRef.current) {
        const startPoint: InsertPoint = ctx.start;
        const current: InsertPoint = ctx.current;
        const bounds = ctx.bounds;
        const pose = posefromBoundsRef.current(bounds);
        const r = b.onMove?.(gctx, { start: startPoint, current, bounds, pose });
        if (!r) continue;
        if (r.start !== undefined) ctx.setStart(r.start);
        if (r.current !== undefined) ctx.setCurrent(r.current);
      }
    },
    onEnd: (ctx) => {
      const insertLabel = insertLabelRef.current;
      const pointInsert = pointInsertRef.current;
      const clickOnly = clickOnlyRef.current;
      const applyOpsOverride = applyOpsOptionRef.current;
      const adapter = adapterRef.current;
      const dispatch = (ops: Op[]) => {
        if (applyOpsOverride) applyOpsOverride(ops, insertLabel);
        else dispatchApplyBatch(adapter, ops, insertLabel);
      };
      if (clickOnly || ctx.isSubThreshold) {
        if (pointInsert) {
          const created = pointInsert({ x: ctx.start.x, y: ctx.start.y });
          if (created) {
            dispatch([createInsertOp({ node: created, label: insertLabel })]);
            return true;
          }
        }
        return false;
      }
      const created = adapter.commitInsert(ctx.bounds);
      if (!created) return false;
      dispatch([createInsertOp({ node: created, label: insertLabel })]);
      return true;
    },
    onGestureStart,
    onGestureEnd,
  });

  // Map dragRect's overlay to InsertOverlay<TPose>.
  const overlayRef = useRef<InsertOverlay<TPose> | null>(null);
  overlayRef.current = dr.overlay
    ? {
        start: dr.overlay.start,
        current: dr.overlay.current,
        bounds: dr.overlay.bounds,
        pose: posefromBoundsRef.current(dr.overlay.bounds),
      }
    : null;

  return useMemo<InsertController<TNode, TPose>>(
    () => ({
      start: dr.start,
      move: dr.move,
      end: dr.end,
      cancel: dr.cancel,
      get overlay() { return overlayRef.current; },
      get isInserting() { return overlayRef.current !== null; },
      get adapter() { return adapterRef.current; },
      get supportsPointInsert() { return pointInsertRef.current != null; },
      get supportsCommitInsert() { return !clickOnlyRef.current; },
    }),
    [dr.start, dr.move, dr.end, dr.cancel],
  );
}
