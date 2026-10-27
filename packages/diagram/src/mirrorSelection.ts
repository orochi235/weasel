import { useLatest, type NodeId, type SelectionApi } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';

/** Whether `selection` already shows `want`: a set, as the same ids in any order; one id, as its latest pick. */
function agrees(selection: readonly string[], want: string | null | readonly string[]): boolean {
  if (typeof want === 'string' || want === null) return (selection.at(-1) ?? null) === want;
  return selection.length === want.length && want.every((id) => selection.includes(id));
}

/** Keeps a canvas selection and a controlled `selected` prop in step: a prop
 *  change is pushed in, and every click reports what the selection holds after
 *  it — a re-click on the picked node included — as its latest pick and as
 *  every id it holds, in the order they were picked. `selected` is one id, a set
 *  of them, or null for none; one id agrees with a selection whose latest pick
 *  it is, so reporting a pick back does not drop the rest of a set. Wire the
 *  returned handler to `<SceneCanvas onClick>`. */
export function useMirroredSelection(
  selection: Pick<SelectionApi, 'get' | 'set'>,
  selected: string | null | readonly string[] | undefined,
  onSelect: ((id: string | null, ids: readonly string[]) => void) | undefined,
): () => void {
  const want = selected ?? null;
  const key = typeof want === 'string' || want === null ? want : `\u0000${want.join('\u0000')}`;
  const pushed = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (pushed.current === key) return;
    pushed.current = key;
    if (agrees(selection.get() as string[], want)) return;
    selection.set((want === null ? [] : typeof want === 'string' ? [want] : [...want]) as NodeId[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the prop changes, not the canvas
  }, [key]);
  const onSelectRef = useLatest(onSelect);
  return useCallback(() => {
    const ids = [...selection.get()] as string[];
    onSelectRef.current?.(ids.at(-1) ?? null, ids);
  }, [selection, onSelectRef]);
}
