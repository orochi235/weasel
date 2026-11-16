import { watchResize } from './watchResize';

/** Far enough past the viewport that nothing on the page is clipped by the root it widens. */
const FAR = 1e5;

// Half a pixel of slack: two measurements that disagreed by rounding would report every
// frame, and the floored frame cannot see a move that small anyway.
function movedTo(box: DOMRectReadOnly, now: DOMRectReadOnly): boolean {
  return Math.abs(now.left - box.left) > 0.5 || Math.abs(now.top - box.top) > 0.5
    || Math.abs(now.width - box.width) > 0.5 || Math.abs(now.height - box.height) > 0.5;
}

const clips = (overflow: string): boolean => overflow !== '' && overflow !== 'visible';

/**
 * The nearest ancestor that clips `element`'s overflow on its containing-block chain, short of the document: the
 * root its moves are framed in. Null for a fixed box, whose containing block is the viewport.
 */
function clipRootOf(element: Element): Element | null {
  const view = element.ownerDocument.defaultView;
  if (!view) return null;
  const top = element.ownerDocument.documentElement;
  let position = view.getComputedStyle(element).position;
  for (let a = element.parentElement; a && a !== top; a = a.parentElement) {
    if (position === 'fixed') return null;
    const style = view.getComputedStyle(a);
    if (position === 'absolute' && style.position === 'static') continue;
    if (clips(style.overflowX) || clips(style.overflowY)) return a;
    position = style.position;
  }
  return null;
}

/**
 * The root margin that shrinks `root`'s frame to `box`: the viewport's, or a clipping element's padding box. Floored,
 * so the frame holds the box whole.
 */
function marginAround(box: DOMRectReadOnly, root: Element | null, doc: HTMLElement): string {
  const r = root?.getBoundingClientRect();
  const left = r && root ? r.left + root.clientLeft : 0;
  const top = r && root ? r.top + root.clientTop : 0;
  const right = root ? left + root.clientWidth : doc.clientWidth;
  const bottom = root ? top + root.clientHeight : doc.clientHeight;
  return [box.top - top, right - box.right, bottom - box.bottom, box.left - left]
    .map((inset) => `${-Math.floor(inset)}px`)
    .join(' ');
}

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
 *
 * An element an ancestor clips is framed inside that ancestor, which is the
 * observer's root, so no clip stands between the element and its frame; and the
 * ancestor is watched the same way, for a move that carries both. The clipping
 * ancestor is the one found when the watch starts.
 */
export function watchElementMove(element: Element, onMove: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const doc = element.ownerDocument.documentElement;
  const clipRoot = clipRootOf(element);
  let observer: IntersectionObserver | null = null;
  let shown: IntersectionObserver | null = null;
  let unwatchSize: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  // An observer still delivers entries queued before it disconnected, and `onMove` may stop the watch itself.
  let stopped = false;
  const report = (): boolean => {
    if (stopped) return false;
    onMove();
    return !stopped;
  };

  const disconnect = (): void => {
    clearTimeout(retry);
    observer?.disconnect();
    observer = null;
    shown?.disconnect();
    shown = null;
    unwatchSize?.();
    unwatchSize = undefined;
  };

  /** A box with no area cannot be framed, so wait for it to have one. */
  const awaitSize = (): void => {
    unwatchSize = watchResize(element, () => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      if (report()) frame(1);
    });
  };

  /**
   * A box an ancestor clips can move without its overlap with the frame changing: the part it hid comes into view
   * as fast as the part leaving the frame goes. How much of it shows does change, so that is watched too, against
   * a root too large to clip it, by thresholds either side of the `ratio` it shows now.
   */
  const watchShown = (box: DOMRectReadOnly, ratio: number): void => {
    shown?.disconnect();
    if (stopped) return;
    const slack = 0.5 / Math.max(box.width, box.height);
    let first = true;
    shown = new IntersectionObserver(
      (entries) => {
        if (stopped) return;
        const entry = entries[0];
        if (!first || entries.length > 1 || movedTo(box, entry.boundingClientRect)) {
          if (report()) frame(1);
          return;
        }
        first = false;
        // Rounding can put what it reports a hair off what the frame did; centre on its own reading.
        if (Math.abs(entry.intersectionRatio - ratio) > slack) watchShown(box, entry.intersectionRatio);
      },
      {
        rootMargin: `${FAR}px`,
        threshold: [Math.max(0, ratio - slack), Math.min(1, ratio + slack)],
      },
    );
    shown.observe(element);
  };

  const frame = (threshold: number): void => {
    disconnect();
    if (stopped) return;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      awaitSize();
      return;
    }
    let first = true;
    observer = new IntersectionObserver(
      (entries) => {
        if (stopped) return;
        const ratio = entries[0].intersectionRatio;
        const moved = first
          ? entries.length > 1 || movedTo(box, entries[0].boundingClientRect)
          : ratio !== threshold;
        if (moved) {
          if (report()) frame(1);
          return;
        }
        first = false;
        if (ratio === threshold) return;
        // A box partly off the root never reaches the threshold asked for, so
        // ask for what it does reach. One wholly off it reports zero for
        // every frame, wherever it goes; look again once it may have come back.
        if (ratio !== 0) {
          frame(ratio);
          watchShown(box, ratio);
        } else {
          retry = setTimeout(() => {
            if (movedTo(box, element.getBoundingClientRect()) && !report()) return;
            frame(1e-7);
          }, 1000);
        }
      },
      {
        root: clipRoot,
        rootMargin: marginAround(box, clipRoot, doc),
        threshold: Math.max(0, Math.min(1, threshold)) || 1,
      },
    );
    observer.observe(element);
  };

  const unwatchClip = clipRoot ? watchElementMove(clipRoot, () => void report()) : undefined;
  frame(1);
  return () => {
    stopped = true;
    unwatchClip?.();
    disconnect();
  };
}
