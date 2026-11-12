import { useCallback, useEffect, useRef } from 'react';
import { LENS_REST_MS } from './lensTypes';

/**
 * How long a lens's capture effect waits: nothing on its first run after a mount, {@link LENS_REST_MS} after that.
 * The same function every render. A remount starts over, StrictMode's included, so its first capture is not held back as a repeat.
 */
export function useCaptureDelay(): () => number {
  const started = useRef(false);
  useEffect(
    () => () => {
      started.current = false;
    },
    [],
  );
  return useCallback(() => {
    const ms = started.current ? LENS_REST_MS : 0;
    started.current = true;
    return ms;
  }, []);
}
