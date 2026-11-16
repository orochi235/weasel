/** What {@link watchResize} watches: one element or several. A null or undefined among them is skipped. */
export type ResizeTargets = Element | null | undefined | Iterable<Element | null | undefined>;

// Not by `Symbol.iterator`: a form or a select is an element that iterates its controls.
const isElement = (targets: object): targets is Element => typeof (targets as Element).getBoundingClientRect === 'function';

/**
 * Call `onResize` whenever any of `targets` resizes, with the observer's entries; also once soon after the watch
 * starts, as a `ResizeObserver` reports every element it is handed. Returns the function that stops watching.
 *
 * Where `ResizeObserver` is absent (jsdom, older embedders) nothing is watched and the returned function does
 * nothing, so a caller that needs a first reading takes it itself.
 */
export function watchResize(
  targets: ResizeTargets,
  onResize: (entries: readonly ResizeObserverEntry[]) => void,
  options?: ResizeObserverOptions,
): () => void {
  if (typeof ResizeObserver === 'undefined' || targets == null) return () => {};
  const observer = new ResizeObserver((entries) => onResize(entries));
  for (const el of isElement(targets) ? [targets] : targets) if (el) observer.observe(el, options);
  return () => observer.disconnect();
}
