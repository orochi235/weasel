/**
 * Call `onMove` when `element`'s box moves in the viewport for a reason no
 * event reports: a sibling collapsing, content loading above it. A scroll or a
 * resize of the element may also call it; a caller already listening for those
 * hears a second, harmless report. Returns the function that stops watching.
 *
 * There is no observer for position, so this frames the element's current box
 * with an `IntersectionObserver` whose root margin is that box exactly. Any move
 * changes how much of the element the frame holds, which the observer reports,
 * and the frame is then rebuilt around the new box.
 */
export function watchElementMove(element: Element, onMove: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const root = element.ownerDocument.documentElement;
  let observer: IntersectionObserver | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const stop = (): void => {
    clearTimeout(retry);
    observer?.disconnect();
    observer = null;
  };

  const frame = (threshold: number): void => {
    stop();
    const { left, top, width, height } = element.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const insets = [
      Math.floor(top),
      Math.floor(root.clientWidth - (left + width)),
      Math.floor(root.clientHeight - (top + height)),
      Math.floor(left),
    ];
    let first = true;
    observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0].intersectionRatio;
        if (ratio !== threshold) {
          if (!first) {
            onMove();
            frame(1);
            return;
          }
          // A box partly off the root never reaches the threshold asked for, so
          // ask for what it does reach. One wholly off it reports zero for
          // every frame; look again once it may have come back.
          if (ratio === 0) retry = setTimeout(() => frame(1e-7), 1000);
          else frame(ratio);
        }
        first = false;
      },
      { rootMargin: insets.map((inset) => `${-inset}px`).join(' '), threshold: Math.max(0, Math.min(1, threshold)) || 1 },
    );
    observer.observe(element);
  };

  frame(1);
  return stop;
}
