import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { isInControlWithin, startThresholdDrag, useLatest, type ThresholdDragHandle } from '@weasel-js/core';
import { resolveDrop, type DropMark, type DropRow, type ResolvedDrop, type TreeDropTarget } from '../../dropTarget';
import { swallowNextClick, type PressModifiers, type ReorderGhost } from '../../useReorderDragList';
import { draggedIdsFor, isNoopMove, landsInside } from './treeMoves';
import type { TreeNode } from './Tree';
import { modsOf } from './treeUtils';

const HOVER_EXPAND_MS = 600;

/** A visible row as `Tree` walks it. */
export interface TreeDragRow {
  node: TreeNode;
  parentId: string | null;
  level: number;
  index: number;
}

export interface UseTreeDragOptions {
  enabled: boolean;
  nodes: readonly TreeNode[];
  visible: readonly TreeDragRow[];
  expanded: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  container(): HTMLElement | null;
  rowEl(id: string): HTMLElement | undefined;
  canDrop?(ids: readonly string[], target: TreeDropTarget): boolean;
  onMove?(ids: string[], target: TreeDropTarget): void;
  onDragOutside?(ids: readonly string[], point: { x: number; y: number } | null): boolean;
  onDropOutside?(ids: string[], point: { x: number; y: number }): void;
  externalDrag?: { x: number; y: number } | null;
  onExternalTarget?(target: TreeDropTarget | null): void;
  /** A press released without dragging — the row's activation. */
  onPress(id: string, mods: PressModifiers): void;
  expand(id: string): void;
}

export interface TreeDragState {
  dragging: readonly string[] | null;
  mark: DropMark | null;
  ghost: ReorderGhost | null;
}

const IDLE: TreeDragState = { dragging: null, mark: null, ghost: null };

/** Pointer drag-to-reorder for `Tree`. Inert unless `enabled`. */
export function useTreeDrag(opts: UseTreeDragOptions) {
  const o = useLatest(opts);
  const drag = useRef<ThresholdDragHandle | null>(null);
  const hover = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [state, setState] = useState<TreeDragState>(IDLE);

  const clearHover = () => {
    if (hover.current) clearTimeout(hover.current.timer);
    hover.current = null;
  };
  useEffect(() => () => { drag.current?.cancel(); clearHover(); }, []);

  const resolve = useCallback((ids: readonly string[], x: number, y: number): ResolvedDrop | null => {
    const { visible, expanded, rowEl, nodes, canDrop } = o.current;
    const rows: DropRow[] = [];
    for (const v of visible) {
      const el = rowEl(v.node.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rows.push({
        id: v.node.id, parentId: v.parentId, level: v.level, index: v.index,
        branch: !!v.node.children, expanded: expanded.has(v.node.id),
        childCount: v.node.children?.length ?? 0, top: r.top, height: r.height,
      });
    }
    const first = visible[0] && rowEl(visible[0].node.id);
    const deep = visible.find((v) => v.level > 1);
    const deepEl = deep && rowEl(deep.node.id);
    const parentEl = deep?.parentId != null ? rowEl(deep.parentId) : undefined;
    const indent = first && deepEl && parentEl
      ? { originX: first.getBoundingClientRect().left, indent: deepEl.getBoundingClientRect().left - parentEl.getBoundingClientRect().left }
      : undefined;
    const hit = resolveDrop(rows, { x, y }, indent);
    if (landsInside(nodes, ids, hit.target) || isNoopMove(nodes, ids, hit.target)) return null;
    if (canDrop && !canDrop(ids, hit.target)) return null;
    return hit;
  }, [o]);

  // Whether something outside the tree has said it would take the drag in flight.
  const outside = useRef<readonly string[] | null>(null);
  const leaveOutside = useCallback(() => {
    if (outside.current) o.current.onDragOutside?.(outside.current, null);
    outside.current = null;
  }, [o]);

  const reset = useCallback(() => {
    drag.current = null;
    clearHover();
    leaveOutside();
    setState(IDLE);
  }, [leaveOutside]);

  // A drag begun elsewhere: mark where it would land here, and say so.
  const [external, setExternal] = useState<ResolvedDrop | null>(null);
  const at = opts.externalDrag;
  const atX = at?.x;
  const atY = at?.y;
  useEffect(() => {
    const box = o.current.container()?.getBoundingClientRect();
    const inside = box && atX !== undefined && atY !== undefined
      && atX >= box.left && atX <= box.right && atY >= box.top && atY <= box.bottom;
    const hit = inside ? resolve([], atX, atY) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the mark comes from measured row rects, which only an effect may read
    setExternal(hit);
    o.current.onExternalTarget?.(hit?.target ?? null);
  }, [atX, atY, o, resolve]);

  const onPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    const { enabled, container } = o.current;
    const box = container();
    if (!enabled || !box || drag.current || e.button !== 0) return;
    if (o.current.visible.find((v) => v.node.id === id)?.node.disabled) return;
    if ((e.target as Element).closest('[data-tree-twisty]')) return;
    if (isInControlWithin(e.target, e.currentTarget)) return;
    const mods = modsOf(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let ids: string[] = [];

    const update = (ev: { clientX: number; clientY: number }) => {
      const r = box.getBoundingClientRect();
      const out = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      const taken = out && o.current.onDragOutside?.(ids, { x: ev.clientX, y: ev.clientY }) === true;
      if (taken) outside.current = ids;
      else leaveOutside();
      const hit = taken ? null : resolve(ids, ev.clientX, ev.clientY);
      const into = hit?.mark?.where === 'into' ? hit.mark.id : null;
      if (into && !o.current.expanded.has(into)) {
        if (hover.current?.id !== into) {
          clearHover();
          hover.current = { id: into, timer: setTimeout(() => o.current.expand(into), HOVER_EXPAND_MS) };
        }
      } else {
        clearHover();
      }
      setState({
        dragging: ids,
        mark: hit?.mark ?? null,
        ghost: { ids, left: ev.clientX - grab.x, top: ev.clientY - grab.y, width: rect.width },
      });
    };

    drag.current = startThresholdDrag(e, {
      origin: box,
      onActivate: (ev) => {
        ids = draggedIdsFor(o.current.nodes, o.current.selected, id);
        update(ev);
      },
      onMove: update,
      onCommit: (ev) => {
        if (outside.current) {
          o.current.onDropOutside?.(ids, { x: ev.clientX, y: ev.clientY });
        } else {
          const hit = resolve(ids, ev.clientX, ev.clientY);
          if (hit) o.current.onMove?.(ids, hit.target);
        }
        reset();
      },
      onClick: () => {
        o.current.onPress(id, mods);
        swallowNextClick(box);
        reset();
      },
      onCancel: reset,
    });
  }, [o, resolve, reset, leaveOutside]);

  return { state: state.mark || !external ? state : { ...state, mark: external.mark ?? null }, onPointerDown };
}
