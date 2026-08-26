import { type KeyboardEvent, useCallback, useEffect, useRef } from 'react';

/** Where a key takes focus within `count` items, or null if it does not move it. */
export function nextIndex(current: number, key: string, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * The APG roving-tabindex contract: exactly one item in the tab order, arrows
 * moving focus within. `tabIndex` is written onto the DOM nodes rather than
 * threaded through props, because the items are arbitrary children — the
 * container never sees them as a list it could index.
 */
export function useRovingTabIndex<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const stop = useRef(0);

  const items = useCallback(
    (): HTMLElement[] =>
      ref.current
        ? Array.from(
            ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [role="button"]'),
          )
        : [],
    [],
  );

  const setTabStop = useCallback(
    (index: number) => {
      const found = items();
      const at = Math.min(Math.max(index, 0), Math.max(found.length - 1, 0));
      stop.current = at;
      for (const [i, el] of found.entries()) el.tabIndex = i === at ? 0 : -1;
    },
    [items],
  );

  // Re-establish the tab stop whenever the item set changes — a trial's toolbar
  // contributions are dynamic, and `disabled` moves a button in and out of the
  // set without touching the child list. The focused item keeps the stop.
  useEffect(() => {
    const resync = () => {
      const focused = items().indexOf(document.activeElement as HTMLElement);
      setTabStop(focused === -1 ? stop.current : focused);
    };
    resync();
    if (!ref.current) return;
    const mo = new MutationObserver(resync);
    mo.observe(ref.current, { childList: true, subtree: true, attributeFilter: ['disabled'] });
    return () => mo.disconnect();
  }, [items, setTabStop]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<T>) => {
      const found = items();
      const current = found.indexOf(document.activeElement as HTMLElement);
      const next = nextIndex(current === -1 ? 0 : current, e.key, found.length);
      if (next === null) return;
      e.preventDefault();
      found[next]?.focus();
      setTabStop(next);
    },
    [items, setTabStop],
  );

  return { ref, onKeyDown };
}
