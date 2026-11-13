import { useLatest, type NodeId, type SelectionApi } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';

/** Whether `selection` already shows `want`: a set, as the same ids in any order; one id, as its latest pick. */
function agrees(selection: readonly string[], want: string | null | readonly string[]): boolean {
  if (typeof want === 'string' || want === null) return (selection.at(-1) ?? null) === want;
  return selection.length === want.length && want.every((id) => selection.includes(id));
}

const idsKey = (ids: readonly string[]): string => ids.join('\u0000');

/** Keeps a canvas selection and a controlled `selected` prop in step: a prop
 *  change is pushed in, and every click reports what the selection holds after
 *  it — a re-click on the picked node included — as its latest pick and as
 *  every id it holds, in the order they were picked. `selected` is one id, a set
 *  of them, or null for none; one id agrees with a selection whose latest pick
 *  it is, so reporting a pick back does not drop the rest of a set. Wire the
 *  returned handler to `<SceneCanvas onClick>`. Given `subscribe` (the
 *  selection store's), a change made any other way — a drag that picks the
 *  node it moves, a marquee, a key — is reported too, a microtask later, and a
 *  change pushed in from `selected` is not. */
export function useMirroredSelection(
  selection: Pick<SelectionApi, 'get' | 'set'>,
  selected: string | null | readonly string[] | undefined,
  onSelect: ((id: string | null, ids: readonly string[]) => void) | undefined,
  subscribe?: (listener: () => void) => () => void,
): () => void {
  const want = selected ?? null;
  const key = typeof want === 'string' || want === null ? want : `\u0000${want.join('\u0000')}`;
  const pushed = useRef<string | null | undefined>(undefined);
  // The selection the host already knows of: the last one reported, or pushed in.
  const known = useRef<string | null>(null);
  useEffect(() => {
    if (pushed.current === key) return;
    pushed.current = key;
    if (!agrees(selection.get() as string[], want)) {
      selection.set((want === null ? [] : typeof want === 'string' ? [want] : [...want]) as NodeId[]);
    }
    known.current = idsKey(selection.get() as string[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the prop changes, not the canvas
  }, [key]);
  const onSelectRef = useLatest(onSelect);
  const report = useCallback(() => {
    const ids = [...selection.get()] as string[];
    known.current = idsKey(ids);
    onSelectRef.current?.(ids.at(-1) ?? null, ids);
  }, [selection, onSelectRef]);
  useEffect(() => {
    if (subscribe === undefined) return;
    let live = true;
    const changed = () => known.current !== null && idsKey(selection.get() as string[]) !== known.current;
    const off = subscribe(() => {
      // Later, so a click's own report goes first and this one finds nothing new.
      if (changed()) queueMicrotask(() => { if (live && changed()) report(); });
    });
    return () => { live = false; off(); };
  }, [subscribe, selection, report]);
  return report;
}
