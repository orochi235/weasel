import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { isInControlWithin, startThresholdDrag, useLatest, type ThresholdDragHandle } from '@weasel-js/core';
import { resolveDrop, type DropMark, type DropRow, type ResolvedDrop, type TreeDropTarget } from '../../dropTarget';
import { swallowNextClick, type PressModifiers, type ReorderGhost } from '../../useReorderDragList';
import { draggedIdsFor, isNoopMove, landsInside } from './treeMoves';
import type { TreeNode } from './Tree';
import { modsOf } from './treeUtils';

const HOVER_EXPAND_MS = 600;

/**
 * What a drag would do with its rows where it lands. `copy`, with Alt held in a tree that takes copies, and
 * `link`, with Alt and Cmd or Ctrl held in one that takes links, both leave the rows where they are.
 */
export type TreeDragEffect = 'move' | 'copy' | 'link';

interface Modifiers {
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

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
  canDrop?(ids: readonly string[], target: TreeDropTarget, effect: TreeDragEffect): boolean;
  onMove?(ids: string[], target: TreeDropTarget): void;
  onCopy?(ids: string[], target: TreeDropTarget): void;
  onLink?(ids: string[], target: TreeDropTarget): void;
  onDragOutside?(ids: readonly string[], point: { x: number; y: number } | null, effect: TreeDragEffect): boolean;
  onDropOutside?(ids: string[], point: { x: number; y: number }, effect: TreeDragEffect): void;
  externalDrag?: { x: number; y: number } | null;
  onExternalTarget?(target: TreeDropTarget | null): void;
  /** A press released without dragging — the row's activation. */
  onPress(id: string, mods: PressModifiers): void;
  expand(id: string): void;
}

export interface TreeDragState {
  dragging: readonly string[] | null;
  /** What the drag in flight would do. */
  effect: TreeDragEffect;
  mark: DropMark | null;
  ghost: ReorderGhost | null;
}

const IDLE: TreeDragState = { dragging: null, effect: 'move', mark: null, ghost: null };

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


  const resolve = useCallback((ids: readonly string[], x: number, y: number, effect: TreeDragEffect = 'move'): ResolvedDrop | null => {
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
    // A copy or a link dropped where its original sits is a second row beside it, and not nothing.
    if (landsInside(nodes, ids, hit.target) || (effect === 'move' && isNoopMove(nodes, ids, hit.target))) return null;
    if (canDrop && !canDrop(ids, hit.target, effect)) return null;
    return hit;
  }, [o]);

  // Whether something outside the tree has said it would take the drag in flight.
  const outside = useRef<readonly string[] | null>(null);
  const leaveOutside = useCallback(() => {
    if (outside.current) o.current.onDragOutside?.(outside.current, null, 'move');
    outside.current = null;
  }, [o]);

  // A modifier pressed or let go with the pointer still: the drag changes what it would do without moving.
  const unwatchAlt = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    drag.current = null;
    unwatchAlt.current?.();
    unwatchAlt.current = null;
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

    let last = { clientX: e.clientX, clientY: e.clientY };
    const effectOf = (ev: Modifiers): TreeDragEffect => {
      if (!ev.altKey) return 'move';
      if ((ev.metaKey || ev.ctrlKey) && o.current.onLink) return 'link';
      return o.current.onCopy ? 'copy' : 'move';
    };
    const update = (ev: { clientX: number; clientY: number } & Modifiers) => {
      last = { clientX: ev.clientX, clientY: ev.clientY };
      const how = effectOf(ev);
      const r = box.getBoundingClientRect();
      const out = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      const taken = out && o.current.onDragOutside?.(ids, { x: ev.clientX, y: ev.clientY }, how) === true;
      if (taken) outside.current = ids;
      else leaveOutside();
      const hit = taken ? null : resolve(ids, ev.clientX, ev.clientY, how);
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
        effect: how,
        mark: hit?.mark ?? null,
        ghost: { ids, left: ev.clientX - grab.x, top: ev.clientY - grab.y, width: rect.width },
      });
    };

    drag.current = startThresholdDrag(e, {
      origin: box,
      onActivate: (ev) => {
        ids = draggedIdsFor(o.current.nodes, o.current.selected, id);
        update(ev);
        // The event carries the modifiers as they stand once this key has changed.
        const onKey = (k: KeyboardEvent) => {
          if (k.key === 'Alt' || k.key === 'Meta' || k.key === 'Control') update({ ...last, altKey: k.altKey, metaKey: k.metaKey, ctrlKey: k.ctrlKey });
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        unwatchAlt.current = () => {
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
        };
      },
      onMove: update,
      onCommit: (ev) => {
        const how = effectOf(ev);
        if (outside.current) {
          o.current.onDropOutside?.(ids, { x: ev.clientX, y: ev.clientY }, how);
        } else {
          const hit = resolve(ids, ev.clientX, ev.clientY, how);
          if (hit) o.current[how === 'link' ? 'onLink' : how === 'copy' ? 'onCopy' : 'onMove']?.(ids, hit.target);
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
