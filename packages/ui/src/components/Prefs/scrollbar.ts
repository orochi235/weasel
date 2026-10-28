/**
 * A ref that sets `data-scrollbar` on its element while the element's scrollbar takes room of its own (a classic
 * one, as macOS draws with a mouse connected), and clears it while the scrollbar is laid over the box. A stylesheet
 * that pads the far side to clear an overlaid scrollbar drops that padding under the attribute, so the scrollbar
 * is cleared once either way.
 */
export function markScrollbar(el: HTMLElement | null): (() => void) | undefined {
  if (el === null) return undefined;
  const read = () => {
    const style = getComputedStyle(el);
    const taken = el.offsetWidth - el.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    // Both widths are rounded to whole pixels, so a fractional box can differ by one with no scrollbar at all.
    el.toggleAttribute('data-scrollbar', taken > 1);
  };
  read();
  if (typeof ResizeObserver === 'undefined') return undefined;
  // A classic scrollbar arriving narrows the content box, which is what this observes.
  const observer = new ResizeObserver(read);
  observer.observe(el);
  return () => observer.disconnect();
}
