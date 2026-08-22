import { useCallback, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent, RefCallback } from 'react';

/** One row in a reorderable list. */
export interface LayerListItem {
  id: string;
  label: ReactNode;
  /** Locked rows cannot be dragged, cannot be crossed by drops, and
   *  never combine with other rows in a multi-selection. */
  locked?: boolean;
  /** Optional color swatch rendered before the label. Any CSS color string. */
  swatch?: string;
}

/**
 * Options for {@link useReorderDragList}. `onReorder` receives the dragged ids
 * and the index they were dropped at, measured against the pre-drag `items`.
 */
export interface UseReorderDragListOptions {
  items: LayerListItem[];
  selectedIds: string[];
  onReorder(ids: string[], targetIndex: number): void;
  /** Pointer-move distance (px) before pending drag engages. Default 4. */
  threshold?: number;
}

/**
 * Live drag state for rendering feedback: which ids are being dragged and the
 * insertion index the drop would use. Both `null` when no drag is engaged.
 */
export interface ReorderDragState {
  draggedIds: string[] | null;
  targetIndex: number | null;
}

/**
 * Props to spread onto the list container and each row, plus the live
 * {@link ReorderDragState}.
 */
export interface ReorderDragHandlers {
  rowProps(id: string, index: number): { onPointerDown(e: ReactPointerEvent): void };
  containerProps: {
    ref: RefCallback<HTMLElement>;
    onPointerMove(e: ReactPointerEvent): void;
    onPointerUp(e: ReactPointerEvent): void;
    onPointerCancel(e: ReactPointerEvent): void;
  };
  state: ReorderDragState;
}

interface PendingState {
  id: string;
  sourceIndex: number;
  startX: number;
  startY: number;
  pointerId: number;
}

interface ActiveState extends PendingState {
  draggedIds: string[];
  targetIndex: number;
}

/**
 * The half-open run of indices a row at `sourceIndex` may be dropped into:
 * bounded by the nearest locked row above and below it, so a locked row is a
 * wall in both directions rather than a global ceiling.
 */
function unlockedSegment(items: readonly LayerListItem[], sourceIndex: number): [number, number] {
  let lo = 0;
  for (let i = sourceIndex - 1; i >= 0; i--) {
    if (items[i]?.locked) { lo = i + 1; break; }
  }
  let hi = items.length;
  for (let i = sourceIndex + 1; i < items.length; i++) {
    if (items[i]?.locked) { hi = i; break; }
  }
  return [lo, hi];
}

/**
 * Drag-to-reorder for a vertical list of rows. Dragging a row that is part of
 * the current selection drags the whole selection; dragging any other row
 * drags just that row. Locked rows can neither be dragged nor crossed by a
 * drop. A drop that would leave a contiguous block where it already is does
 * not call `onReorder`.
 *
 * The pointer is captured on the row, so a drag that leaves the list still
 * tracks and still releases cleanly.
 */
export function useReorderDragList(opts: UseReorderDragListOptions): ReorderDragHandlers {
  const { threshold = 4 } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const containerRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef<PendingState | null>(null);
  const activeRef = useRef<ActiveState | null>(null);
  const [state, setState] = useState<ReorderDragState>({ draggedIds: null, targetIndex: null });

  const computeTargetIndex = useCallback((clientY: number, sourceIndex: number): number => {
    const [lo, hi] = unlockedSegment(optsRef.current.items, sourceIndex);
    const c = containerRef.current;
    if (!c) return lo;
    const rows = Array.from(c.children) as HTMLElement[];
    let raw = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const r = row.getBoundingClientRect();
      if (clientY < r.bottom) { raw = i; break; }
    }
    return Math.max(lo, Math.min(raw, hi));
  }, []);

  const refCb = useCallback<RefCallback<HTMLElement>>((el) => {
    containerRef.current = el;
  }, []);

  const onPointerDownRow = useCallback((id: string, index: number, e: ReactPointerEvent) => {
    // Locked items cannot be dragged — skip recording the pending state so
    // pointer-move cannot engage. Plain click still works because LayerList
    // tracks click intent in its own ref, separate from drag candidacy.
    const item = optsRef.current.items[index];
    if (item?.locked) return;
    // Capture the pointer to the row so subsequent move/up events keep firing
    // (on the row, bubbling to the container) even when the user drags
    // outside the list's bounding box. Without capture, releasing outside
    // the container leaves the drag state stuck because pointerup fires on
    // the document, not the list.
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* unsupported / already captured */ }
    pendingRef.current = {
      id,
      sourceIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
  }, []);

  const reset = useCallback(() => {
    pendingRef.current = null;
    activeRef.current = null;
    setState({ draggedIds: null, targetIndex: null });
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const active = activeRef.current;
    if (active) {
      const targetIndex = computeTargetIndex(e.clientY, active.sourceIndex);
      if (targetIndex !== active.targetIndex) {
        active.targetIndex = targetIndex;
        setState({ draggedIds: active.draggedIds, targetIndex });
      }
      return;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;
    if (Math.hypot(dx, dy) < threshold) return;
    // Engage.
    const selected = optsRef.current.selectedIds;
    const inSelection = selected.includes(pending.id);
    const [lo, hi] = unlockedSegment(optsRef.current.items, pending.sourceIndex);
    const draggedIds = (inSelection ? [...selected] : [pending.id]).filter((id) => {
      const i = optsRef.current.items.findIndex((it) => it.id === id);
      return i >= lo && i < hi;
    });
    const targetIndex = computeTargetIndex(e.clientY, pending.sourceIndex);
    activeRef.current = { ...pending, draggedIds, targetIndex };
    setState({ draggedIds, targetIndex });
  }, [computeTargetIndex, threshold]);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    const active = activeRef.current;
    if (!active) {
      reset();
      return;
    }
    const targetIndex = computeTargetIndex(e.clientY, active.sourceIndex);
    // Skip no-op: target lands inside the dragged-ids contiguous block.
    const items = optsRef.current.items;
    const indices = active.draggedIds
      .map((id) => items.findIndex((it) => it.id === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const isContiguous =
      indices.length > 0 &&
      indices.every((v, i) => {
        if (i === 0) return true;
        const prev = indices[i - 1];
        return prev !== undefined && v === prev + 1;
      });
    const first = indices[0];
    const last = indices[indices.length - 1];
    const wouldBeNoop =
      isContiguous &&
      first !== undefined &&
      last !== undefined &&
      targetIndex >= first &&
      targetIndex <= last + 1;
    if (!wouldBeNoop) {
      optsRef.current.onReorder(active.draggedIds, targetIndex);
    }
    reset();
  }, [computeTargetIndex, reset]);

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    rowProps: (id, index) => ({
      onPointerDown: (e) => onPointerDownRow(id, index, e),
    }),
    containerProps: {
      ref: refCb,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    state,
  };
}
