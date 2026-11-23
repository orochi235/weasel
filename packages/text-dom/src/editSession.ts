import { useCallback, useRef, useState } from 'react';
import type { UseTextEditOptions } from './textEditTypes';

/**
 * The id of the node being edited, and the setter that reports each change:
 * `onEnd` for the edit it closes, then `onStart` for the one it opens. The
 * report is made from the call, so nothing following the edit ever renders
 * with the two out of step. `session` counts the edits opened, so one ended
 * and reopened on the same node before a render still reads as a new edit,
 * and `live` is the id as of the last call, ahead of the render.
 */
export function useEditingId(
  opts: { readonly current: Pick<UseTextEditOptions, 'onStart' | 'onEnd'> },
): [string | null, (id: string | null) => void, { readonly current: string | null }, number] {
  const [state, setState] = useState<{ id: string | null; session: number }>({ id: null, session: 0 });
  const live = useRef<string | null>(null);
  const setEditingId = useCallback((id: string | null) => {
    const prev = live.current;
    if (prev === id) return;
    live.current = id;
    setState((s) => ({ id, session: id === null ? s.session : s.session + 1 }));
    if (prev !== null) opts.current.onEnd?.(prev);
    if (id !== null) opts.current.onStart?.(id);
  }, [opts]);
  return [state.id, setEditingId, live, state.session];
}
