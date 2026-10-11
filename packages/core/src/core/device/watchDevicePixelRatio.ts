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
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  let disposed = false;
  let query: MediaQueryList | null = null;
  const onDensity = (): void => {
    if (disposed) return;
    arm();
    onChange(window.devicePixelRatio || 1);
  };
  function arm(): void {
    query?.removeEventListener('change', onDensity);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', onDensity);
  }
  arm();
  return () => {
    disposed = true;
    query?.removeEventListener('change', onDensity);
  };
}
