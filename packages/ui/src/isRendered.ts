/** Whether `el` is drawn: no `display: none` on it or above it, and not `visibility` hidden or collapsed. */
export const isRendered = (el: HTMLElement): boolean => {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  if (view.getComputedStyle(el).visibility !== 'visible') return false;
  for (let at: Element | null = el; at; at = at.parentElement) {
    if (view.getComputedStyle(at).display === 'none') return false;
  }
  return true;
};
