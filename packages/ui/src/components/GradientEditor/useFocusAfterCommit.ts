import { useEffect, useReducer, useRef } from 'react';

/**
 * A handle to select and focus once an edit's commit renders, if the commit left the list at the length the edit
 * expects. A caller that declines the edit leaves nothing armed to fire on some later list of that length.
 */
export function useFocusAfterCommit(length: number, focus: (index: number) => void): {
  /** Arms a focus on `index` for when the list is `count` long. */
  request: (index: number, count: number) => void;
  /** Called with the edit's commit: the next render settles the request either way. */
  committing: () => void;
  drop: () => void;
} {
  const pending = useRef<{ index: number; count: number; committed: boolean } | null>(null);
  const [, settle] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const want = pending.current;
    if (!want?.committed) return;
    pending.current = null;
    if (want.count === length) focus(want.index);
  });
  return {
    request: (index, count) => { pending.current = { index, count, committed: false }; },
    committing: () => {
      if (!pending.current) return;
      pending.current.committed = true;
      settle();
    },
    drop: () => { pending.current = null; },
  };
}
