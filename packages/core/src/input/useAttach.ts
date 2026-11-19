import { useEffect, useRef } from 'react';

/**
 * Keep `attach` attached to the element `resolve` names, checked after every
 * commit: a ref read once in a mount effect misses an element that mounts
 * later or is swapped for another. Re-attaches when the element or `deps`
 * change, and detaches on unmount. No extra render.
 */
export function useAttach<T extends object>(
  resolve: () => T | null,
  attach: (el: T) => () => void,
  deps: readonly unknown[],
): void {
  const live = useRef<{ el: T; deps: readonly unknown[]; detach: () => void } | null>(null);
  useEffect(() => {
    const el = resolve();
    const cur = live.current;
    if (cur && cur.el === el && cur.deps.length === deps.length && cur.deps.every((d, i) => Object.is(d, deps[i]))) return;
    cur?.detach();
    live.current = el ? { el, deps, detach: attach(el) } : null;
  });
  useEffect(() => () => {
    live.current?.detach();
    live.current = null;
  }, []);
}
