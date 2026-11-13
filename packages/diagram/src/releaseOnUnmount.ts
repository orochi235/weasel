import { type RefObject, useEffect, useRef } from 'react';

/**
 * Releases everything `held` holds once the component has unmounted for good, and empties it. The release waits a
 * microtask, and a remount before then cancels it: StrictMode's rehearsal unmount remounts in the same tick, and
 * freeing there would drop what the remounted component still draws.
 */
export function useReleaseOnUnmount<T>(held: RefObject<ReadonlySet<T>>, release: (item: T) => void): void {
  const mounts = useRef(0);
  useEffect(() => {
    mounts.current += 1;
    return () => {
      mounts.current -= 1;
      queueMicrotask(() => {
        if (mounts.current > 0) return;
        const gone = held.current;
        held.current = new Set();
        for (const item of gone) release(item);
      });
    };
  }, [held, release]);
}
