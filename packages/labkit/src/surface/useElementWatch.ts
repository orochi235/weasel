import { watchElementMove } from '@weasel-js/react';
import { useCallback, useEffect, useRef } from 'react';

interface Watched {
  el: HTMLElement;
  moves: boolean;
  unwatchMove?: () => void;
}

/**
 * Calls `onChange` when a watched element resizes, and when one watched for
 * moves also moves with nothing resizing, such as when a sibling beside it
 * settles. `watch(key, null)` stops watching that key.
 */
export function useElementWatch(onChange: () => void): {
  watch: (key: string, el: HTMLElement | null, opts?: { moves?: boolean }) => void;
} {
  const watched = useRef(new Map<string, Watched>());
  const observer = useRef<ResizeObserver | null>(null);

  const start = useCallback(
    (w: Watched) => {
      observer.current?.observe(w.el);
      if (w.moves && observer.current) w.unwatchMove = watchElementMove(w.el, onChange);
    },
    [onChange],
  );
  const stop = useCallback((w: Watched) => {
    observer.current?.unobserve(w.el);
    w.unwatchMove?.();
    w.unwatchMove = undefined;
  }, []);

  const watch = useCallback(
    (key: string, el: HTMLElement | null, opts?: { moves?: boolean }) => {
      const known = watched.current.get(key);
      if (known?.el === el) return;
      if (known) stop(known);
      watched.current.delete(key);
      if (!el) return;
      const w: Watched = { el, moves: opts?.moves ?? false };
      watched.current.set(key, w);
      start(w);
    },
    [start, stop],
  );

  useEffect(() => {
    const all = watched.current;
    observer.current = new ResizeObserver(onChange);
    for (const w of all.values()) start(w);
    return () => {
      for (const w of all.values()) stop(w);
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [onChange, start, stop]);

  return { watch };
}
