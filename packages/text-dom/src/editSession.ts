import { useCallback, useRef, useState } from 'react';
import type { UseTextEditOptions } from './textEditTypes';

/**
 * The id of the node being edited, and the setter that reports each change:
 * `onEnd` for the edit it closes, then `onStart` for the one it opens. The
 * report is made from the call, so nothing following the edit ever renders
 * with the two out of step.
 */
export function useEditingId(
  opts: { readonly current: Pick<UseTextEditOptions, 'onStart' | 'onEnd'> },
): [string | null, (id: string | null) => void] {
  const [editingId, setState] = useState<string | null>(null);
  const live = useRef<string | null>(null);
  const setEditingId = useCallback((id: string | null) => {
    const prev = live.current;
    if (prev === id) return;
    live.current = id;
    setState(id);
    if (prev !== null) opts.current.onEnd?.(prev);
    if (id !== null) opts.current.onStart?.(id);
  }, [opts]);
  return [editingId, setEditingId];
}
