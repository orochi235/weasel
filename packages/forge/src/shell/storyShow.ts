import { useCallback, useEffect, useState } from 'react';

/** Calls `done` once `host`'s fonts are ready and a frame has painted after; returns the cancel. */
export function afterPaint(host: HTMLElement, done: () => void): () => void {
  let canceled = false;
  const finish = () => {
    if (!canceled) done();
  };
  const { fonts } = host.ownerDocument;
  if (!fonts) finish();
  else {
    const frame = () => requestAnimationFrame(finish);
    void fonts.ready.then(frame, frame);
  }
  return () => {
    canceled = true;
  };
}

/**
 * Whether a story host renders its content: while it is near the viewport, or while a caller of `show` holds it.
 * `show` resolves once the content has painted, with the release.
 */
export function useStoryShow(
  host: HTMLElement | null,
  inView: boolean,
): { live: boolean; show: () => Promise<() => void> } {
  const [held, setHeld] = useState(0);
  const [waiters] = useState<(() => void)[]>(() => []);
  const live = inView || held > 0;

  const show = useCallback(
    () =>
      new Promise<() => void>((resolve) => {
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          setHeld((n) => n - 1);
        };
        waiters.push(() => resolve(release));
        setHeld((n) => n + 1);
      }),
    [waiters],
  );

  useEffect(() => {
    if (!host || !live || waiters.length === 0) return;
    const waiting = waiters.splice(0);
    let settled = false;
    const cancel = afterPaint(host, () => {
      settled = true;
      for (const resolve of waiting) resolve();
    });
    return () => {
      cancel();
      if (!settled) waiters.unshift(...waiting);
    };
  }, [host, live, held, waiters]);

  // A caller still waiting when the host goes finds it gone rather than hanging.
  useEffect(
    () => () => {
      for (const resolve of waiters.splice(0)) resolve();
    },
    [waiters],
  );

  return { live, show };
}
