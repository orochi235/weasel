import { useCallback, useRef, useState } from 'react';
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
export interface UseInsertOptions<TPose> {
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
  options: UseInsertOptions<TPose> = {},
): InsertController<TObject, TPose> {
  const {
    behaviors = [],
    insertLabel = 'Insert',
    minBounds = { width: 0, height: 0 },
    posefromBounds = (b) => b as unknown as TPose,
    onGestureStart,
    onGestureEnd,
  } = options;

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const posefromBoundsRef = useRef(posefromBounds);
  posefromBoundsRef.current = posefromBounds;

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
    // ctx.origin/current store the two world points (as TPose-cast InsertPoints).
    // Behaviors mutate them via { start, current } returns.
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
    onGestureStart?.();
    const sp = ctx.origin.get(GID) as unknown as InsertPoint;
    const bounds = boundsFrom(sp, sp);
    setOverlay({ start: sp, current: sp, bounds, pose: posefromBoundsRef.current(bounds) });
  }, [adapter, onGestureStart]);

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
  }, [adapter, cleanup, insertLabel, minBounds.width, minBounds.height, onGestureEnd]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEnd?.(false);
  }, [cleanup, onGestureEnd]);

  return { start, move, end, cancel, isInserting: overlay !== null, overlay, adapter };
}
