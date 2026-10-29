import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent, RefCallback } from 'react';
import { isInControlWithin, startThresholdDrag, useLatest, type ThresholdDragHandle } from '@weasel-js/core';
import { gapByMidpoint, isNoopDrop, nudgeGap } from '@weasel-js/headless';
import { useKitSetting } from '@weasel-js/react';
import type { SelectModifiers } from '@weasel-js/select';

/** One row in a reorderable list. */
export interface ReorderItem {
  id: string;
  label: ReactNode;
  /** Locked rows cannot be dragged, cannot be crossed by drops, and
   *  never combine with other rows in a multi-selection. */
  locked?: boolean;
}

/**
 * Options for {@link useReorderDragList}. `onReorder` receives the dragged ids
 * and the index they were dropped at, measured against the pre-drag `items`.
 */
export interface UseReorderDragListOptions {
  items: ReorderItem[];
  selectedIds: string[];
  onReorder(ids: string[], targetIndex: number): void;
  /** A press that was released without ever engaging a drag — the click a
   *  list row means by it. Fires for locked rows too, which can be selected
   *  but not dragged. Modifiers are read at press, not at release. When this
   *  is given, the DOM click that follows the press is dropped, so a row that
   *  also handles `click` sees one press, not two. A press that starts on a
   *  control inside the row (a toggle) is left to the control. */
  onPress?(id: string, mods: PressModifiers): void;
  /** Pointer-move distance (px) before pending drag engages. Default the `gestures.dragPx` kit setting, else `DRAG_THRESHOLD_PX`. */
  threshold?: number;
  /** Selector matching the container's children that are rows, for a list
   *  that interleaves other elements (a table's detail rows). Default: every
   *  child is a row. */
  rowSelector?: string;
  /** Selector matching the container's children that only wrap rows (a run of
   *  rows in a group of its own), so each one's children are rows of this
   *  list. */
  groupSelector?: string;
  /** Which way the rows run: `'y'`, a column, by default; `'x'` for a row of tabs. */
  axis?: 'x' | 'y';
  /** Measures the rows and the pointer along a line of the list's own instead of `axis`, such as a curve the rows lie
   *  along: where each row starts on it and how long it is, and how far along it the pointer is. */
  line?: ReorderLine;
}

/** A line rows are laid along, measured as {@link UseReorderDragListOptions.line} reads it. */
export interface ReorderLine {
  row(el: HTMLElement): { start: number; length: number };
  pointer(client: { clientX: number; clientY: number }): number;
}

/** Modifier keys held when a press began. */
export interface PressModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** The modifiers an event carries, as a press reports them. */
export function modsOf(e: PressModifiers): PressModifiers {
  return { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey };
}

/** A list's convention: Cmd/Ctrl toggles a row, shift ranges from the anchor. */
export const LIST_KEYS = { toggle: ['meta', 'ctrl'], range: 'shift' } as const;

/** A press's modifiers as `@weasel-js/select` reads them. */
export function selectModifiers(mods: PressModifiers): SelectModifiers {
  return { shift: mods.shiftKey, meta: mods.metaKey, ctrl: mods.ctrlKey };
}

/**
 * Where a drag's ghost goes: the dragged rows, drawn again with their top-left
 * at a client-space point, so the row that was grabbed stays under the pointer
 * where it was picked up. `width` is the grabbed row's.
 */
export interface ReorderGhost {
  ids: readonly string[];
  left: number;
  top: number;
  width: number;
}

/**
 * Live drag state for rendering feedback: which ids are being dragged, the
 * insertion index the drop would use, and where their ghost goes. All `null`
 * when no drag is engaged.
 */
export interface ReorderDragState {
  draggedIds: string[] | null;
  targetIndex: number | null;
  ghost: ReorderGhost | null;
}

const IDLE: ReorderDragState = { draggedIds: null, targetIndex: null, ghost: null };

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
  /**
   * Move the row at `index` one place up (`-1`) or down (`1`) — the keyboard
   * reorder. It moves what a drag of that row would: the whole selection if
   * the row is in it, else the row alone, never across a locked row. Calls
   * `onReorder` and returns `true`, or returns `false` when nothing can move.
   */
  nudge(id: string, index: number, delta: -1 | 1): boolean;
}

/**
 * The half-open run of indices a row at `sourceIndex` may be dropped into:
 * bounded by the nearest locked row above and below it, so a locked row is a
 * wall in both directions rather than a global ceiling.
 */
function unlockedSegment(items: readonly ReorderItem[], sourceIndex: number): [number, number] {
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

/** The screen's own axis as a {@link ReorderLine}: x across a row of tabs, else y down a column. */
function screenLine(across: boolean): ReorderLine {
  return {
    row: (el) => {
      const r = el.getBoundingClientRect();
      return across ? { start: r.left, length: r.width } : { start: r.top, length: r.height };
    },
    pointer: (client) => (across ? client.clientX : client.clientY),
  };
}

function rowElements(
  container: HTMLElement,
  { rowSelector, groupSelector }: Pick<UseReorderDragListOptions, 'rowSelector' | 'groupSelector'>,
): HTMLElement[] {
  const children = Array.from(container.children);
  const rows = groupSelector
    ? children.flatMap((el) => (el.matches(groupSelector) ? Array.from(el.children) : [el]))
    : children;
  return (rowSelector ? rows.filter((el) => el.matches(rowSelector)) : rows) as HTMLElement[];
}

/** What a drag of the row at `index` carries: the selection within its segment if the row is selected, else the row. */
function draggedIdsFor(
  items: readonly ReorderItem[],
  selectedIds: readonly string[],
  id: string,
  index: number,
): string[] {
  const [lo, hi] = unlockedSegment(items, index);
  return (selectedIds.includes(id) ? [...selectedIds] : [id]).filter((x) => {
    const i = items.findIndex((it) => it.id === x);
    return i >= lo && i < hi;
  });
}

/** Where `ids` stand in `items`; an id not there is left out. */
function indicesOf(items: readonly ReorderItem[], ids: readonly string[]): number[] {
  return ids.map((id) => items.findIndex((it) => it.id === id)).filter((i) => i >= 0);
}

/**
 * Drag-to-reorder for a list of rows, a column by default or a row with `axis: 'x'`. Dragging a row that is part of
 * the current selection drags the whole selection; dragging any other row
 * drags just that row. Locked rows can neither be dragged nor crossed by a
 * drop. A drop that would leave a contiguous block where it already is does
 * not call `onReorder`.
 *
 * The rows are the container's children, whatever they are. A row's
 * `onPointerDown` can go on the whole row or on a handle inside it.
 *
 * A press opens a `startThresholdDrag` on the *container*, which owns the
 * rest of the gesture: a drag that leaves the list still tracks, a release
 * anywhere still drops, and a release the window never delivered still ends
 * the drag. The container is the origin rather than the row because rows come
 * and go as the list re-renders, and a drag must outlive the row it grabbed.
 */
export function useReorderDragList(opts: UseReorderDragListOptions): ReorderDragHandlers {
  const dragPx = useKitSetting('gestures.dragPx');
  const optsRef = useLatest({ ...opts, threshold: opts.threshold ?? dragPx });
  const containerRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<ThresholdDragHandle | null>(null);
  const [state, setState] = useState<ReorderDragState>(IDLE);

  useEffect(() => () => { dragRef.current?.cancel(); }, []);

  const computeTargetIndex = useCallback((client: { clientX: number; clientY: number }, sourceIndex: number): number => {
    const line = optsRef.current.line ?? screenLine(optsRef.current.axis === 'x');
    const [lo, hi] = unlockedSegment(optsRef.current.items, sourceIndex);
    const c = containerRef.current;
    if (!c) return lo;
    const mids = rowElements(c, optsRef.current).map((row) => {
      const { start, length } = line.row(row);
      return start + length / 2;
    });
    const raw = gapByMidpoint(mids, line.pointer(client));
    return Math.max(lo, Math.min(raw, hi));
  }, [optsRef]);

  const refCb = useCallback<RefCallback<HTMLElement>>((el) => {
    containerRef.current = el;
  }, []);

  const reset = useCallback(() => {
    dragRef.current = null;
    setState(IDLE);
  }, []);

  const onPointerDownRow = useCallback((id: string, index: number, e: ReactPointerEvent) => {
    const container = containerRef.current;
    if (!container || dragRef.current) return;
    if (isInControlWithin(e.target, e.currentTarget as Element)) return;

    const mods: PressModifiers = {
      shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
    };
    let draggedIds: string[] = [];
    let targetIndex = 0;
    // Where in the grabbed row the pointer went down, so the ghost keeps that point under it. The handler may sit on
    // a handle inside the row rather than the row itself, so the row is the container's child holding it.
    const pressed = e.currentTarget as Element;
    const rowEl = rowElements(container, optsRef.current).find((child) => child.contains(pressed)) ?? pressed;
    const row = rowEl.getBoundingClientRect();
    const grab = { x: e.clientX - row.left, y: e.clientY - row.top };
    const ghostAt = (ev: { clientX: number; clientY: number }): ReorderGhost => ({
      ids: draggedIds,
      left: ev.clientX - grab.x,
      top: ev.clientY - grab.y,
      width: row.width,
    });

    dragRef.current = startThresholdDrag(e, {
      origin: container,
      // A locked row still opens a drag so its release reaches `onPress`, and
      // a threshold nothing can cross is what keeps it from ever engaging.
      threshold: optsRef.current.items[index]?.locked
        ? Number.POSITIVE_INFINITY
        : optsRef.current.threshold,
      onActivate: (ev) => {
        draggedIds = draggedIdsFor(optsRef.current.items, optsRef.current.selectedIds, id, index);
        targetIndex = computeTargetIndex(ev, index);
        setState({ draggedIds, targetIndex, ghost: ghostAt(ev) });
      },
      onMove: (ev) => {
        targetIndex = computeTargetIndex(ev, index);
        setState({ draggedIds, targetIndex, ghost: ghostAt(ev) });
      },
      onCommit: (ev) => {
        const drop = computeTargetIndex(ev, index);
        if (!isNoopDrop(indicesOf(optsRef.current.items, draggedIds), drop)) {
          optsRef.current.onReorder(draggedIds, drop);
        }
        reset();
      },
      onClick: () => {
        const { onPress } = optsRef.current;
        if (onPress) {
          onPress(id, mods);
          swallowNextClick(container);
        }
        reset();
      },
      // Every cancel reason — the browser's, a lost capture, an unmount —
      // says the gesture was interrupted rather than aimed, so the rows stay
      // where they were.
      onCancel: reset,
    });
  }, [computeTargetIndex, reset, optsRef]);

  const nudge = useCallback((id: string, index: number, delta: -1 | 1): boolean => {
    const { items, selectedIds, onReorder } = optsRef.current;
    if (items[index]?.locked) return false;
    const ids = draggedIdsFor(items, selectedIds, id, index);
    const at = indicesOf(items, ids);
    const target = nudgeGap(at, delta, items.length);
    const [lo, hi] = unlockedSegment(items, index);
    if (target === null || target < lo || target > hi || isNoopDrop(at, target)) return false;
    onReorder(ids, target);
    return true;
  }, [optsRef]);

  return {
    nudge,
    rowProps: (id, index) => ({
      onPointerDown: (e) => onPointerDownRow(id, index, e),
    }),
    containerProps: {
      ref: refCb,
    },
    state,
  };
}

/**
 * The session captured the pointer on the container, so browsers disagree on
 * where the release's click lands; it may still reach the row. `onPress` has
 * already reported this press, so that click is dropped rather than read as a
 * second one. It is dispatched in the same task as the release.
 */
export function swallowNextClick(container: HTMLElement): void {
  const swallow = (e: Event) => { e.stopPropagation(); };
  container.addEventListener('click', swallow, true);
  setTimeout(() => { container.removeEventListener('click', swallow, true); }, 0);
}
