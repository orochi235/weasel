/** Whether `el` is drawn: no `display: none` on it or above it, and not `visibility` hidden or collapsed.
 *  Where `checkVisibility` is missing (jsdom), `display` is read only on `el` and its ancestors below `within`:
 *  under an undrawn `within` the answer is then `true`, so pass one only where that cannot matter. */
export const isRendered = (el: HTMLElement, within?: Element | null): boolean => {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  const own = view.getComputedStyle(el);
  if (own.visibility !== 'visible' || own.display === 'none') return false;
  for (let at = el.parentElement; at && at !== within; at = at.parentElement) {
    if (view.getComputedStyle(at).display === 'none') return false;
  }
  return true;
};
