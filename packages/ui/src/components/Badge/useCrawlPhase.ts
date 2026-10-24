import { useEffect, useRef, useState } from 'react';
import { useVisibleRaf } from '@weasel-js/core';

/** A 0..1 phase that advances `crawl` cycles a second (0.2 for `true`), and rests at 0 when `crawl` is off. */
export function useCrawlPhase(crawl: boolean | number | undefined): number {
  const [phase, setPhase] = useState(0);
  const lastRef = useRef<number | null>(null);
  const loop = useVisibleRaf(
    (now, self) => {
      const speed = typeof crawl === 'number' ? crawl : 0.2;
      const last = lastRef.current;
      lastRef.current = now;
      if (last !== null) setPhase((p) => (p + (speed * (now - last)) / 1000) % 1);
      self.request();
    },
    // A crawl does not advance while nobody is watching it, so the frame that
    // resumes it must not apply the whole interval at once.
    { onResume: () => { lastRef.current = null; } },
  );

  useEffect(() => {
    if (!crawl) return;
    lastRef.current = null;
    loop.request();
    return () => loop.cancel();
  }, [crawl, loop]);
  return crawl ? phase : 0;
}
