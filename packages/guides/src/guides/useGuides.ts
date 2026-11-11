import { useCallback, useMemo, useRef, useState } from 'react';
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
  /** Stable getter; reads the latest list without forcing a re-render, a
   *  change included as soon as it is made. Pass to `guideSnapSource` and
   *  `createGuidesLayer`. */
  getGuides: () => Guide[];
  /** Add a guide, at `index` when given, else at the end. If a guide with the
   *  same id already exists it is replaced where it stands; one equal to it
   *  changes nothing. */
  addGuide: (guide: Guide, index?: number) => void;
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
 * It keeps no history of its own and persists nothing: `addGuideOp`,
 * `replaceGuideOp`, and `removeGuideOp` make a change an undo step on a canvas's history.
 */
export function useGuides(initial: Guide[] = []): UseGuidesReturn {
  const [guides, setGuides] = useState<Guide[]>(initial);
  // The list as last written, ahead of the render that shows it: an op in a batch reads what the one before it wrote.
  const ref = useRef(guides);
  const changed = useMemo(() => createEmitter(), []);
  const write = useCallback((next: Guide[]) => {
    if (next === ref.current) return;
    ref.current = next;
    setGuides(next);
    changed.emit();
  }, [changed]);

  const getGuides = useCallback(() => ref.current, []);
  const subscribe = useCallback((listener: () => void) => changed.subscribe(listener), [changed]);

  const addGuide = useCallback((guide: Guide, index?: number) => {
    const prev = ref.current;
    const idx = prev.findIndex((g) => g.id === guide.id);
    if (idx === -1) {
      if (index === undefined || index >= prev.length) return write([...prev, guide]);
      const next = prev.slice();
      next.splice(Math.max(0, index), 0, guide);
      return write(next);
    }
    if (sameGuide(prev[idx]!, guide)) return;
    const next = prev.slice();
    next[idx] = guide;
    write(next);
  }, [write]);

  const removeGuide = useCallback((id: string) => {
    const idx = ref.current.findIndex((g) => g.id === id);
    if (idx === -1) return;
    const next = ref.current.slice();
    next.splice(idx, 1);
    write(next);
  }, [write]);

  const clearGuides = useCallback(() => {
    if (ref.current.length > 0) write([]);
  }, [write]);

  return { guides, getGuides, addGuide, removeGuide, clearGuides, subscribe };
}
