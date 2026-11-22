import { useEffect, useReducer, useRef } from 'react';

/** How a settled request lands: whether the handle takes focus, and whether the selection is reported even unmoved. */
export interface Landing {
  focus: boolean;
  report: boolean;
}

/**
 * A handle to select, and maybe focus, once an edit's commit renders, if the commit left the list at the length the
 * edit expects. A caller that declines the edit leaves nothing armed to fire on some later list of that length.
 */
export function useFocusAfterCommit(length: number, land: (index: number, how: Landing) => void): {
  /** Arms a selection of `index` for when the list is `count` long. */
  request: (index: number, count: number, how: Landing) => void;
  /** Called with the edit's commit: the next render settles the request either way. */
  committing: () => void;
  drop: () => void;
} {
  const pending = useRef<{ index: number; count: number; how: Landing; committed: boolean } | null>(null);
  const [, settle] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const want = pending.current;
    if (!want?.committed) return;
    pending.current = null;
    if (want.count === length) land(want.index, want.how);
  });
  return {
    request: (index, count, how) => { pending.current = { index, count, how, committed: false }; },
    committing: () => {
      if (!pending.current) return;
      pending.current.committed = true;
      settle();
    },
    drop: () => { pending.current = null; },
  };
}
