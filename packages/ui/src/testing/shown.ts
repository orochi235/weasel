/**
 * Whether a reader can see `el`: drawn, and inside no box that clips its content to the 1px or less a visually
 * hidden element keeps (React Aria's native `<select>` behind its own). A thin box that does not clip hides nothing.
 */
export function shown(el: Element): boolean {
  if (getComputedStyle(el).visibility === 'hidden') return false;
  for (let at: Element | null = el; at; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.display === 'none') return false;
    if (style.display === 'contents') continue;
    const box = at.getBoundingClientRect();
    if ((box.width <= 1 && style.overflowX !== 'visible') || (box.height <= 1 && style.overflowY !== 'visible')) return false;
  }
  return true;
}
