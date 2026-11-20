/**
 * Call `onChange` each time `view.devicePixelRatio` changes: the window
 * moved to a display of another density, or the page zoomed. `view` is the
 * global window by default; a popout's is its own. Returns the unsubscribe.
 * A no-op where `matchMedia` does not exist.
 *
 * `(resolution: Ndppx)` stops matching as soon as density changes, so one
 * listener fires once and goes dead; this arms a fresh query at the new
 * density on every change.
 */
export function watchDevicePixelRatio(
  onChange: (dpr: number) => void,
  view?: Window | null,
): () => void {
  const found = view ?? (typeof window === 'undefined' ? null : window);
  if (!found || typeof found.matchMedia !== 'function') return () => {};
  const win: Window = found;
  let disposed = false;
  let stop = (): void => {};
  const density = (): number => win.devicePixelRatio || 1;
  const onDensity = (): void => {
    if (disposed) return;
    arm();
    onChange(density());
  };
  function arm(): void {
    stop();
    const mq = win.matchMedia(`(resolution: ${density()}dppx)`);
    mq?.addEventListener?.('change', onDensity);
    stop = () => mq?.removeEventListener?.('change', onDensity);
  }
  arm();
  return () => {
    disposed = true;
    stop();
  };
}
