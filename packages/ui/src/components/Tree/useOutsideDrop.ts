import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react';
import type { ResolvedDrop, TreeDropTarget } from '../../dropTarget';

/** What a caller dropping onto a `Tree` from outside it asks, through the tree's `dropRef`. */
export interface TreeDropHandle {
  /**
   * Where something let go at this client point would land, or `null` where the tree takes nothing: off its box,
   * with no rows, or where `canDrop`, asked with no ids, refuses. It is the hit test behind the mark an
   * `externalDrag` draws, read from the rows as they are laid out now, so it is right for a release the tree has
   * not rendered a move for. `canDrop` is asked in the same call, so what it answers from must be current then
   * too: a ref, and not state set by the event that is asking.
   */
  targetAt(point: { x: number; y: number }): TreeDropTarget | null;
}

export interface UseOutsideDropOptions {
  /** The client point of a drag begun outside the tree, while there is one. */
  at: { x: number; y: number } | null | undefined;
  /** The tree's latest callbacks, read when asked and never captured. */
  latest: { readonly current: { container(): HTMLElement | null; onExternalTarget?(target: TreeDropTarget | null): void } };
  /** Where a drop of nothing the tree holds would land at a client point its rows cover. */
  resolve(ids: readonly string[], x: number, y: number): ResolvedDrop | null;
  handle?: Ref<TreeDropHandle>;
}

/** A drag begun outside a `Tree`: the mark for where it would land, and the answer to where a drop does. */
export function useOutsideDrop({ at, latest, resolve, handle }: UseOutsideDropOptions): ResolvedDrop | null {
  const hitAt = useCallback((x: number, y: number): ResolvedDrop | null => {
    const box = latest.current.container()?.getBoundingClientRect();
    if (!box || x < box.left || x > box.right || y < box.top || y > box.bottom) return null;
    return resolve([], x, y);
  }, [latest, resolve]);

  const [marked, setMarked] = useState<ResolvedDrop | null>(null);
  const x = at?.x;
  const y = at?.y;
  useEffect(() => {
    const hit = x !== undefined && y !== undefined ? hitAt(x, y) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the mark comes from measured row rects, which only an effect may read
    setMarked(hit);
    latest.current.onExternalTarget?.(hit?.target ?? null);
  }, [x, y, latest, hitAt]);

  useImperativeHandle(handle, () => ({ targetAt: (p) => hitAt(p.x, p.y)?.target ?? null }), [hitAt]);
  return marked;
}
