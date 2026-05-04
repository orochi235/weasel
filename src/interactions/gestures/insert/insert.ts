import { useCallback, useMemo, useRef, useState } from 'react';
import { createInsertOp } from '../../../core/ops/create';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { InsertAdapter } from '../../../core/adapters/types';
import type {
  GestureContext,
  InsertBehavior,
  InsertOverlay,
  InsertPoint,
  ModifierState,
  ResizePose,
} from '../types';

/** Options for `useInsert`. */
export interface UseInsertOptions<TPose, TObject extends { id: string } = { id: string }> {
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
  pointInsert?: (point: { x: number; y: number }) => TObject | null;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

/** Return shape of `useInsert`: lifecycle methods plus the live drag-rectangle overlay. */
export interface InsertController<TObject extends { id: string }, TPose> {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isInserting: boolean;
  overlay: InsertOverlay<TPose> | null;
  /** The adapter passed in. Exposed so `<Canvas>` can derive defaults. */
  adapter: InsertAdapter<TObject>;
}

const GID = 'gesture';

function boundsFrom(start: InsertPoint, current: InsertPoint): ResizePose {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/** Drag-rectangle insert interaction; the adapter materializes the new object on commit. */
export function useInsert<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertOptions<TPose, TObject> = {},
): InsertController<TObject, TPose> {
  const {
    behaviors = [],
    insertLabel = 'Insert',
    minBounds = { width: 0, height: 0 },
    posefromBounds = (b) => b as unknown as TPose,
    pointInsert,
    onGestureStart,
    onGestureEnd,
  } = options;

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const posefromBoundsRef = useRef(posefromBounds);
  posefromBoundsRef.current = posefromBounds;
  // Latest-value refs so controller methods stay referentially stable.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const insertLabelRef = useRef(insertLabel);
  insertLabelRef.current = insertLabel;
  const minBoundsRef = useRef(minBounds);
  minBoundsRef.current = minBounds;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;
  const pointInsertRef = useRef(pointInsert);
  pointInsertRef.current = pointInsert;

  const stateRef = useRef<{ active: boolean; ctx: GestureContext<TPose> | null }>({
    active: false,
    ctx: null,
  });
  const [overlay, setOverlay] = useState<InsertOverlay<TPose> | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current.active = false;
    stateRef.current.ctx = null;
    setOverlay(null);
  }, []);

  const start = useCallback((worldX: number, worldY: number, modifiers: ModifierState) => {
    const adapter = adapterRef.current;
    const startPoint: InsertPoint = { x: worldX, y: worldY };
    const ctx: GestureContext<TPose> = {
      draggedIds: [GID],
      origin: new Map([[GID, startPoint as unknown as TPose]]),
      current: new Map([[GID, startPoint as unknown as TPose]]),
      snap: null,
      modifiers,
      pointer: { worldX, worldY, clientX: 0, clientY: 0 },
      adapter: adapter as unknown as GestureContext<TPose>['adapter'],
      scratch: {},
    };
    for (const b of behaviorsRef.current) b.onStart?.(ctx);
    stateRef.current = { active: true, ctx };
    onGestureStartRef.current?.();
    const sp = ctx.origin.get(GID) as unknown as InsertPoint;
    const bounds = boundsFrom(sp, sp);
    setOverlay({ start: sp, current: sp, bounds, pose: posefromBoundsRef.current(bounds) });
  }, []);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s.active || !s.ctx) return false;
    const ctx = s.ctx;
    ctx.modifiers = modifiers;
    ctx.pointer = { worldX, worldY, clientX: 0, clientY: 0 };
    let current: InsertPoint = { x: worldX, y: worldY };
    let startPoint = ctx.origin.get(GID) as unknown as InsertPoint;
    let bounds = boundsFrom(startPoint, current);
    let pose = posefromBoundsRef.current(bounds);

    for (const b of behaviorsRef.current) {
      const r = b.onMove?.(ctx, { start: startPoint, current, bounds, pose });
      if (!r) continue;
      if (r.current !== undefined) current = r.current;
      if (r.start !== undefined) {
        startPoint = r.start;
        ctx.origin.set(GID, startPoint as unknown as TPose);
      }
      bounds = boundsFrom(startPoint, current);
      pose = posefromBoundsRef.current(bounds);
    }
    ctx.current.set(GID, current as unknown as TPose);
    setOverlay({ start: startPoint, current, bounds, pose });
    return true;
  }, []);

  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const insertLabel = insertLabelRef.current;
    const minBounds = minBoundsRef.current;
    const onGestureEnd = onGestureEndRef.current;
    if (!s.active || !s.ctx) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const ctx = s.ctx;
    const sp = ctx.origin.get(GID) as unknown as InsertPoint;
    const cp = ctx.current.get(GID) as unknown as InsertPoint;
    const bounds = boundsFrom(sp, cp);
    if (bounds.width <= minBounds.width || bounds.height <= minBounds.height) {
      const pointInsert = pointInsertRef.current;
      if (pointInsert) {
        const created = pointInsert({ x: sp.x, y: sp.y });
        if (created) {
          const ops: Op[] = [createInsertOp({ object: created, label: insertLabel })];
          dispatchApplyBatch(adapter, ops, insertLabel);
          cleanup();
          onGestureEnd?.(true);
          return;
        }
      }
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const created = adapter.commitInsert(bounds);
    if (!created) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const ops: Op[] = [createInsertOp({ object: created, label: insertLabel })];
    dispatchApplyBatch(adapter, ops, insertLabel);
    cleanup();
    onGestureEnd?.(true);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEndRef.current?.(false);
  }, [cleanup]);

  // Stable controller identity — see useMove for rationale.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const controller = useMemo<InsertController<TObject, TPose>>(() => ({
    start, move, end, cancel,
    get overlay() { return overlayRef.current; },
    get isInserting() { return overlayRef.current !== null; },
    get adapter() { return adapterRef.current; },
  }), [start, move, end, cancel]);
  return controller;
}
