import { watchMedia } from '@weasel-js/react';

/**
 * Call `onChange` each time `window.devicePixelRatio` changes: the window
 * moved to a display of another density, or the page zoomed. Returns the
 * unsubscribe. A no-op where `matchMedia` does not exist.
 *
 * `(resolution: Ndppx)` stops matching as soon as density changes, so one
 * listener fires once and goes dead; this arms a fresh query at the new
 * density on every change.
 */
export function watchDevicePixelRatio(onChange: (dpr: number) => void): () => void {
  if (typeof window === 'undefined' || typeof matchMedia !== 'function') return () => {};
  let disposed = false;
  let stop = (): void => {};
  const density = (): number => window.devicePixelRatio || 1;
  const onDensity = (): void => {
    if (disposed) return;
    arm();
    onChange(density());
  };
  function arm(): void {
    stop();
    stop = watchMedia(`(resolution: ${density()}dppx)`, onDensity);
  }
  arm();
  return () => {
    disposed = true;
    stop();
  };
}
