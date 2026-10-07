import { useLatest, type NodeId, type SelectionApi } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';

/** Keeps a canvas selection and a controlled `selected` prop in step: a prop
 *  change is pushed in, and every click reports what the selection holds after
 *  it — a re-click on the picked node included. Wire the returned handler to
 *  `<SceneCanvas onClick>`. */
export function useMirroredSelection(
  selection: Pick<SelectionApi, 'get' | 'set'>,
  selected: string | null | undefined,
  onSelect: ((id: string | null) => void) | undefined,
): () => void {
  const want = selected ?? null;
  const pushed = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (pushed.current === want) return;
    pushed.current = want;
    if ((selection.get()[0] ?? null) !== want) selection.set(want === null ? [] : [want as NodeId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the prop changes, not the canvas
  }, [want]);
  const onSelectRef = useLatest(onSelect);
  return useCallback(() => {
    onSelectRef.current?.((selection.get()[0] as string | undefined) ?? null);
  }, [selection, onSelectRef]);
}
