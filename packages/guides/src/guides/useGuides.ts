import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useLatest } from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';
import type { Guide } from './types';

/** Field by field, `span` by its ends. */
function sameGuide(a: Guide, b: Guide): boolean {
  const keys = Object.keys(a) as (keyof Guide)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => (k === 'span'
    ? a.span?.min === b.span?.min && a.span?.max === b.span?.max && (a.span === undefined) === (b.span === undefined)
    : Object.is(a[k], b[k])));
}

/** Return shape for `useGuides`. */
export interface UseGuidesReturn {
  /** Live list (state). Re-renders when guides change. */
  guides: Guide[];
  /** Stable getter; reads the latest list without forcing a re-render.
   *  Pass to `guideSnapSource` and `createGuidesLayer`. */
  getGuides: () => Guide[];
  /** Add a guide. If a guide with the same id already exists it is replaced;
   *  one equal to it changes nothing. */
  addGuide: (guide: Guide) => void;
  /** Remove a guide by id. No-op when missing. */
  removeGuide: (id: string) => void;
  /** Drop all guides. */
  clearGuides: () => void;
  /** Hear each change to the list, once `getGuides` returns it: pass to
   *  `createGuidesLayer` so the canvas repaints when a guide comes or goes. */
  subscribe: (listener: () => void) => () => void;
}

/**
 * In-memory guide storage. Holds a list of horizontal/vertical world-space
 * lines that callers can pass to `guideSnapSource` (snap source) and
 * `createGuidesLayer` (render layer).
 *
 * It keeps no history of its own and persists nothing: `addGuideOp` and
 * `removeGuideOp` make a change an undo step on a canvas's history.
 */
export function useGuides(initial: Guide[] = []): UseGuidesReturn {
  const [guides, setGuides] = useState<Guide[]>(initial);
  const ref = useLatest(guides);

  const getGuides = useCallback(() => ref.current, [ref]);
  const changed = useMemo(() => createEmitter(), []);
  const subscribe = useCallback((listener: () => void) => changed.subscribe(listener), [changed]);
  const [first] = useState(guides);
  useLayoutEffect(() => {
    if (guides !== first) changed.emit();
  }, [changed, guides, first]);

  const addGuide = useCallback((guide: Guide) => {
    setGuides((prev) => {
      const idx = prev.findIndex((g) => g.id === guide.id);
      if (idx === -1) return [...prev, guide];
      if (sameGuide(prev[idx]!, guide)) return prev;
      const next = prev.slice();
      next[idx] = guide;
      return next;
    });
  }, []);

  const removeGuide = useCallback((id: string) => {
    setGuides((prev) => {
      const idx = prev.findIndex((g) => g.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const clearGuides = useCallback(() => {
    setGuides((prev) => (prev.length === 0 ? prev : []));
  }, []);

  return { guides, getGuides, addGuide, removeGuide, clearGuides, subscribe };
}
