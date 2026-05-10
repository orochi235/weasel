import { useCallback, useRef, useState } from 'react';
import type { Guide } from './types';

/** Return shape for `useGuides`. */
export interface UseGuidesReturn {
  /** Live list (state). Re-renders when guides change. */
  guides: Guide[];
  /** Stable getter; reads the latest list without forcing a re-render.
   *  Pass to `guideSnapStrategy` and `createGuidesLayer`. */
  getGuides: () => Guide[];
  /** Add a guide. If a guide with the same id already exists it is replaced. */
  addGuide: (guide: Guide) => void;
  /** Remove a guide by id. No-op when missing. */
  removeGuide: (id: string) => void;
  /** Drop all guides. */
  clearGuides: () => void;
}

/**
 * In-memory guide storage. Holds a list of horizontal/vertical world-space
 * lines that callers can pass to `guideSnapStrategy` (snap behavior) and
 * `createGuidesLayer` (render layer).
 *
 * v1 is intentionally minimal: no undo integration, no persistence, no
 * batched mutation. Wrap calls in your own history-aware action if you
 * want guide CRUD to be undoable.
 */
export function useGuides(initial: Guide[] = []): UseGuidesReturn {
  const [guides, setGuides] = useState<Guide[]>(initial);
  const ref = useRef<Guide[]>(initial);
  ref.current = guides;

  const getGuides = useCallback(() => ref.current, []);

  const addGuide = useCallback((guide: Guide) => {
    setGuides((prev) => {
      const idx = prev.findIndex((g) => g.id === guide.id);
      if (idx === -1) return [...prev, guide];
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

  return { guides, getGuides, addGuide, removeGuide, clearGuides };
}
