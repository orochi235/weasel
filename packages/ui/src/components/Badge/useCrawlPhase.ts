import { useEffect, useRef, useState } from 'react';
import { useVisibleRaf } from '@weasel-js/react';
import { wrapPositive } from '@weasel-js/geom';

/** `phase` moved on by `speed` cycles a second over `dtMs`, kept in 0..1 whichever way it runs. */
export function advancePhase(phase: number, speed: number, dtMs: number): number {
  return wrapPositive(phase + (speed * dtMs) / 1000, 1);
}

/** A 0..1 phase that advances `crawl` cycles a second (0.2 for `true`), and rests at 0 when `crawl` is off. */
export function useCrawlPhase(crawl: boolean | number | undefined): number {
  const [phase, setPhase] = useState(0);
  const lastRef = useRef<number | null>(null);
  const loop = useVisibleRaf(
    (now, self) => {
      const speed = typeof crawl === 'number' ? crawl : 0.2;
      const last = lastRef.current;
      lastRef.current = now;
      if (last !== null) setPhase((p) => advancePhase(p, speed, now - last));
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
