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
 *
 * A frame only watches from its first report on, so that report is checked
 * against the box the frame was built around: a move in between is reported too.
 */
export function watchElementMove(element: Element, onMove: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const root = element.ownerDocument.documentElement;
  let observer: IntersectionObserver | null = null;
  let sized: ResizeObserver | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const stop = (): void => {
    clearTimeout(retry);
    observer?.disconnect();
    observer = null;
    sized?.disconnect();
    sized = null;
  };

  /** A box with no area cannot be framed, so wait for it to have one. */
  const awaitSize = (): void => {
    if (typeof ResizeObserver === 'undefined') return;
    sized = new ResizeObserver(() => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      onMove();
      frame(1);
    });
    sized.observe(element);
  };

  const frame = (threshold: number): void => {
    stop();
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      awaitSize();
      return;
    }
    const insets = [
      Math.floor(box.top),
      Math.floor(root.clientWidth - box.right),
      Math.floor(root.clientHeight - box.bottom),
      Math.floor(box.left),
    ];
    // Half a pixel of slack: two measurements that disagreed by rounding would report every
    // frame, and the floored frame cannot see a move that small anyway.
    const movedTo = (now: DOMRectReadOnly): boolean =>
      Math.abs(now.left - box.left) > 0.5 || Math.abs(now.top - box.top) > 0.5
      || Math.abs(now.width - box.width) > 0.5 || Math.abs(now.height - box.height) > 0.5;
    let first = true;
    observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0].intersectionRatio;
        const moved = first
          ? entries.length > 1 || movedTo(entries[0].boundingClientRect)
          : ratio !== threshold;
        if (moved) {
          onMove();
          frame(1);
          return;
        }
        first = false;
        if (ratio === threshold) return;
        // A box partly off the root never reaches the threshold asked for, so
        // ask for what it does reach. One wholly off it reports zero for
        // every frame, wherever it goes; look again once it may have come back.
        if (ratio !== 0) frame(ratio);
        else {
          retry = setTimeout(() => {
            if (movedTo(element.getBoundingClientRect())) onMove();
            frame(1e-7);
          }, 1000);
        }
      },
      { rootMargin: insets.map((inset) => `${-inset}px`).join(' '), threshold: Math.max(0, Math.min(1, threshold)) || 1 },
    );
    observer.observe(element);
  };

  frame(1);
  return stop;
}
