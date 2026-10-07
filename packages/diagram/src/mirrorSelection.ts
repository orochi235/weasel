import type { NodeId, SelectionApi } from '@weasel-js/core';
import { useEffect, useRef } from 'react';

/** Keeps a canvas selection and a controlled `selected` prop in step: a prop
 *  change is pushed in, a pick on the canvas is reported out. */
export function useMirroredSelection(
  selection: Pick<SelectionApi, 'current' | 'set'>,
  selected: string | null | undefined,
  onSelect: ((id: string | null) => void) | undefined,
): void {
  const picked = (selection.current[0] as string | undefined) ?? null;
  const want = selected ?? null;
  const pushed = useRef<string | null | undefined>(undefined);
  const seen = useRef(picked);
  useEffect(() => {
    if (pushed.current === want) return;
    pushed.current = want;
    if (picked !== want) selection.set(want === null ? [] : [want as NodeId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the prop changes, not the canvas
  }, [want]);
  useEffect(() => {
    if (seen.current === picked) return;
    seen.current = picked;
    if (picked !== want) onSelect?.(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the canvas changes, not the prop
  }, [picked]);
}
