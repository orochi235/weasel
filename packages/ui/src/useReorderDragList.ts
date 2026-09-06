import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent, RefCallback } from 'react';
import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';

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
  /** A press that was released without ever engaging a drag — the click a
   *  list row means by it. Fires for locked rows too, which can be selected
   *  but not dragged. Modifiers are read at press, not at release. */
  onPress?(id: string, mods: PressModifiers): void;
  /** Pointer-move distance (px) before pending drag engages. Default 4. */
  threshold?: number;
}

/** Modifier keys held when a press began. */
export interface PressModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
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
 * A `ref` for the list container, an `onPointerDown` for each row, and the
 * live {@link ReorderDragState}. The container ref is required, not optional
 * decoration: it is what the drop index is measured against and what the
 * pointer session is opened on.
 */
export interface ReorderDragHandlers {
  rowProps(id: string, index: number): { onPointerDown(e: ReactPointerEvent): void };
  containerProps: {
    ref: RefCallback<HTMLElement>;
  };
  state: ReorderDragState;
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

/** Would dropping `draggedIds` at `targetIndex` leave a contiguous block where it already is? */
function isNoopDrop(items: readonly LayerListItem[], draggedIds: readonly string[], targetIndex: number): boolean {
  const indices = draggedIds
    .map((id) => items.findIndex((it) => it.id === id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  const contiguous =
    indices.length > 0 &&
    indices.every((v, i) => {
      if (i === 0) return true;
      const prev = indices[i - 1];
      return prev !== undefined && v === prev + 1;
    });
  const first = indices[0];
  const last = indices[indices.length - 1];
  return contiguous
    && first !== undefined
    && last !== undefined
    && targetIndex >= first
    && targetIndex <= last + 1;
}

/**
 * Drag-to-reorder for a vertical list of rows. Dragging a row that is part of
 * the current selection drags the whole selection; dragging any other row
 * drags just that row. Locked rows can neither be dragged nor crossed by a
 * drop. A drop that would leave a contiguous block where it already is does
 * not call `onReorder`.
 *
 * A press opens a `startThresholdDrag` on the *container*, which owns the
 * rest of the gesture: a drag that leaves the list still tracks, a release
 * anywhere still drops, and a release the window never delivered still ends
 * the drag. The container is the origin rather than the row because rows come
 * and go as the list re-renders, and a drag must outlive the row it grabbed.
 */
export function useReorderDragList(opts: UseReorderDragListOptions): ReorderDragHandlers {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const containerRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<ThresholdDragHandle | null>(null);
  const [state, setState] = useState<ReorderDragState>({ draggedIds: null, targetIndex: null });

  useEffect(() => () => { dragRef.current?.cancel(); }, []);

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

  const reset = useCallback(() => {
    dragRef.current = null;
    setState({ draggedIds: null, targetIndex: null });
  }, []);

  const onPointerDownRow = useCallback((id: string, index: number, e: ReactPointerEvent) => {
    const container = containerRef.current;
    if (!container || dragRef.current) return;

    const mods: PressModifiers = {
      shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
    };
    let draggedIds: string[] = [];
    let targetIndex = 0;

    dragRef.current = startThresholdDrag(e, {
      origin: container,
      // A locked row still opens a drag so its release reaches `onPress`, and
      // a threshold nothing can cross is what keeps it from ever engaging.
      threshold: optsRef.current.items[index]?.locked
        ? Number.POSITIVE_INFINITY
        : (optsRef.current.threshold ?? 4),
      onActivate: (ev) => {
        const selected = optsRef.current.selectedIds;
        const [lo, hi] = unlockedSegment(optsRef.current.items, index);
        draggedIds = (selected.includes(id) ? [...selected] : [id]).filter((x) => {
          const i = optsRef.current.items.findIndex((it) => it.id === x);
          return i >= lo && i < hi;
        });
        targetIndex = computeTargetIndex(ev.clientY, index);
        setState({ draggedIds, targetIndex });
      },
      onMove: (ev) => {
        const next = computeTargetIndex(ev.clientY, index);
        if (next === targetIndex) return;
        targetIndex = next;
        setState({ draggedIds, targetIndex });
      },
      onCommit: (ev) => {
        const drop = computeTargetIndex(ev.clientY, index);
        if (!isNoopDrop(optsRef.current.items, draggedIds, drop)) {
          optsRef.current.onReorder(draggedIds, drop);
        }
        reset();
      },
      onClick: () => {
        optsRef.current.onPress?.(id, mods);
        reset();
      },
      // Every cancel reason — the browser's, a lost capture, an unmount —
      // says the gesture was interrupted rather than aimed, so the rows stay
      // where they were.
      onCancel: reset,
    });
  }, [computeTargetIndex, reset]);

  return {
    rowProps: (id, index) => ({
      onPointerDown: (e) => onPointerDownRow(id, index, e),
    }),
    containerProps: {
      ref: refCb,
    },
    state,
  };
}
