import { useEffect, useState } from 'react';
import type { RedrawSource } from '../core/layers/render';

/** Subscribe `requestRedraw` to each source while mounted. An inline array
 *  holding the same sources does not resubscribe. */
export function useRedrawOn(sources: readonly RedrawSource[] | undefined, requestRedraw: () => void): void {
  const kept = useSameElements(sources);
  useEffect(() => {
    const redraw = (): void => { requestRedraw(); };
    const offs = (kept ?? []).map((src) => src.subscribe(redraw));
    return () => { for (const off of offs) off(); };
  }, [kept, requestRedraw]);
}

/** `list` as last passed, kept by identity while it holds the same elements —
 *  so an inline array prop does not read as a change every render. */
function useSameElements<T>(list: readonly T[] | undefined): readonly T[] | undefined {
  // Derived state rather than a ref, so a render React throws away can't
  // leave its list behind as the one the next render compares against.
  const [kept, setKept] = useState(list);
  if (kept !== list && !(kept && list && kept.length === list.length && kept.every((x, i) => x === list[i]))) {
    setKept(list);
    return list;
  }
  return kept;
}
