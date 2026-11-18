import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import type { EventModifiers } from '@weasel-js/gestures';
import { useKitSetting, useLatest } from '@weasel-js/react';
import { after } from '@weasel-js/registry';
import { startThresholdDrag, swallowNextClick, type ThresholdDragHandle } from '@weasel-js/routing';
import type { DropMark, ResolvedDrop, TreeDropTarget } from '../../dropTarget';
import type { ReorderGhost } from '../../useReorderDragList';
import { draggedIdsFor, isNoopMove, landsInside } from './treeMoves';
import type { TreeNode } from './Tree';
import { modsOf } from '../../useReorderDragList';
import { useOutsideDrop, type TreeDropHandle } from './useOutsideDrop';
import { isContextPress, isPrimaryPress, modHeld, isInControlWithin } from '@weasel-js/gestures';
import { dropAt, type TreeDragRow } from './treeDropAt';
import type {} from '../../kitSettings';

export type { TreeDragRow } from './treeDropAt';

export const HOVER_EXPAND_MS = 600;
/** How far the ghost's corner sits from the pointer, so what is under the pointer stays visible. */
const GHOST_OFFSET = 10;

/**
 * What a drag would do with its rows where it lands. `copy`, with Alt held in a tree that takes copies, and
 * `link`, with Alt and Cmd (Ctrl off Apple platforms) held in one that takes links, both leave the rows where they are.
 */
export type TreeDragEffect = 'move' | 'copy' | 'link';

interface Modifiers {
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
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
  dropRef?: Ref<TreeDropHandle>;
  /** A press released without dragging — the row's activation. */
  onPress(id: string, mods: EventModifiers): void;
  expand(id: string): void;
}

export interface TreeDragState {
  dragging: readonly string[] | null;
  /** What the drag in flight would do. */
  effect: TreeDragEffect;
  mark: DropMark | null;
  ghost: ReorderGhost | null;
  /** The pointer, in client space, and whether it is off the tree's box. */
  pointer: { x: number; y: number; outside: boolean } | null;
}

/** A press on this node starts no drag. */
const stays = (node: TreeNode | undefined) => !!node && (!!node.disabled || !!node.immovable);

const IDLE: TreeDragState ={ dragging: null, effect: 'move', mark: null, ghost: null, pointer: null };

/** What a drag does with these modifiers held, in a tree taking what `takes` has handlers for. */
function effectFor(mods: Modifiers, takes: Pick<UseTreeDragOptions, 'onCopy' | 'onLink'>): TreeDragEffect {
  if (!mods.altKey) return 'move';
  if (modHeld(mods) && takes.onLink) return 'link';
  return takes.onCopy ? 'copy' : 'move';
}

/** Whether a client point is off `box`. */
const outsideOf = (box: HTMLElement, x: number, y: number): boolean => {
  const r = box.getBoundingClientRect();
  return x < r.left || x > r.right || y < r.top || y > r.bottom;
};

/** Report each press and release of Alt, Meta or Control to `onChange`, with the modifiers as they stand after it,
 *  until the returned function is called. */
function watchModifierKeys(onChange: (mods: Modifiers) => void): () => void {
  const onKey = (k: KeyboardEvent) => {
    if (k.key === 'Alt' || k.key === 'Meta' || k.key === 'Control') onChange({ altKey: k.altKey, metaKey: k.metaKey, ctrlKey: k.ctrlKey });
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  };
}

/** Opens a closed row once a drag has rested over it: `aim` at the row a drop would go into, or at null. */
function useHoverExpand() {
  const hover = useRef<{ id: string; cancel: () => void } | null>(null);
  const clear = useCallback(() => {
    hover.current?.cancel();
    hover.current = null;
  }, []);
  const aim = useCallback((into: string | null, delayMs: number, expand: (id: string) => void) => {
    if (into === null) { clear(); return; }
    if (hover.current?.id === into) return;
    clear();
    hover.current = { id: into, cancel: after(delayMs, () => expand(into)) };
  }, [clear]);
  return useMemo(() => ({ aim, clear }), [aim, clear]);
}

/** Pointer drag-to-reorder for `Tree`. Inert unless `enabled`. */
export function useTreeDrag(opts: UseTreeDragOptions) {
  const o = useLatest({ ...opts, hoverExpandMs: useKitSetting('tree.hoverExpandMs') ?? HOVER_EXPAND_MS, dragPx: useKitSetting('gestures.dragPx') });
  const drag = useRef<ThresholdDragHandle | null>(null);
  const hover = useHoverExpand();
  const [state, setState] = useState<TreeDragState>(IDLE);

  useEffect(() => () => { drag.current?.cancel(); hover.clear(); }, [hover]);

  const resolve = useCallback((ids: readonly string[], x: number, y: number, effect: TreeDragEffect = 'move'): ResolvedDrop | null => {
    const { visible, expanded, rowEl, nodes, canDrop } = o.current;
    const hit = dropAt(visible, rowEl, expanded, x, y);
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
  const unwatchMods = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    drag.current = null;
    unwatchMods.current?.();
    unwatchMods.current = null;
    hover.clear();
    leaveOutside();
    setState(IDLE);
  }, [leaveOutside, hover]);

  const external = useOutsideDrop({ at: opts.externalDrag, latest: o, resolve, handle: opts.dropRef });

  const onPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    const { enabled, container } = o.current;
    const box = container();
    if (!enabled || !box || drag.current || !isPrimaryPress(e) || isContextPress(e)) return;
    if (stays(o.current.visible.find((v) => v.node.id === id)?.node)) return;
    if ((e.target as Element).closest('[data-tree-twisty]')) return;
    if (isInControlWithin(e.target, e.currentTarget)) return;
    const mods = modsOf(e);
    const rect = e.currentTarget.getBoundingClientRect();
    let ids: string[] = [];

    let last = { clientX: e.clientX, clientY: e.clientY };
    const update = (ev: { clientX: number; clientY: number } & Modifiers) => {
      last = { clientX: ev.clientX, clientY: ev.clientY };
      const how = effectFor(ev, o.current);
      const out = outsideOf(box, ev.clientX, ev.clientY);
      const taken = out && o.current.onDragOutside?.(ids, { x: ev.clientX, y: ev.clientY }, how) === true;
      if (taken) outside.current = ids;
      else leaveOutside();
      const hit = taken ? null : resolve(ids, ev.clientX, ev.clientY, how);
      const into = hit?.mark?.where === 'into' ? hit.mark.id : null;
      hover.aim(into && !o.current.expanded.has(into) ? into : null, o.current.hoverExpandMs, (row) => o.current.expand(row));
      setState({
        dragging: ids,
        effect: how,
        mark: hit?.mark ?? null,
        // A row's height down, so the row the pointer is on, in this tree or one like it, is clear of the ghost.
        ghost: { ids, left: ev.clientX + GHOST_OFFSET, top: ev.clientY + Math.max(GHOST_OFFSET, rect.height), width: rect.width },
        pointer: { x: ev.clientX, y: ev.clientY, outside: out },
      });
    };

    drag.current = startThresholdDrag(e, {
      origin: box, threshold: o.current.dragPx,
      onStart: (ev) => {
        ids = draggedIdsFor(o.current.nodes, o.current.selected, id);
        update(ev);
        // The event carries the modifiers as they stand once this key has changed.
        unwatchMods.current = watchModifierKeys((m) => update({ ...last, ...m }));
      },
      onMove: update,
      onEnd: (ev) => {
        const how = effectFor(ev, o.current);
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
        swallowNextClick(box, { keepDefault: true });
        reset();
      },
      onCancel: reset,
    });
  }, [o, resolve, reset, leaveOutside, hover]);

  return { state: state.mark || !external ? state : { ...state, mark: external.mark ?? null }, onPointerDown };
}
