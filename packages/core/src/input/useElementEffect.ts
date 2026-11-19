import { useEffect, useRef } from 'react';

/**
 * Runs `setup` against the element `read` returns, re-running it when that
 * element or any of `deps` changes. `read` is called after every render,
 * since a ref's element can mount, unmount, or be swapped with nothing in
 * `deps` changing.
 */
export function useElementEffect<T extends EventTarget>(
  read: () => T | null,
  setup: (el: T) => (() => void) | void,
  deps: readonly unknown[],
): void {
  const live = useRef<{ el: T; deps: readonly unknown[]; cleanup: (() => void) | void } | null>(null);
  useEffect(() => {
    const el = read();
    const cur = live.current;
    if (cur && cur.el === el && sameDeps(cur.deps, deps)) return;
    cur?.cleanup?.();
    live.current = el ? { el, deps, cleanup: setup(el) } : null;
  });
  useEffect(() => () => {
    live.current?.cleanup?.();
    live.current = null;
  }, []);
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}
