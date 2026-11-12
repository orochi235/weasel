/** Options for {@link onLeave}. */
export interface OnLeaveOptions {
  /** Listen in the capture phase, so `fn` runs ahead of other flushes on the same event. */
  capture?: boolean;
}

/**
 * Run `fn` whenever the page goes away or turns hidden: a write still waiting on a timer is due now. Hidden counts
 * because it is the last event a mobile browser, or a background tab the browser later discards, is sure to send;
 * `pagehide` alone misses both, and a hidden tab's timers run late or not at all. `fn` may run twice for one leave,
 * so it writes only what is still pending. Answers the stop; outside a browser, nothing listens.
 */
export function onLeave(fn: () => void, options: OnLeaveOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {};
  const capture = options.capture === true;
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') fn();
  };
  // Captured on the window, it runs before any listener on the document; uncaptured, on the document, it hears an
  // event dispatched there that does not bubble.
  const hears: EventTarget = capture ? window : document;
  window.addEventListener('pagehide', fn, capture);
  hears.addEventListener('visibilitychange', onVisibility, capture);
  return () => {
    window.removeEventListener('pagehide', fn, capture);
    hears.removeEventListener('visibilitychange', onVisibility, capture);
  };
}
