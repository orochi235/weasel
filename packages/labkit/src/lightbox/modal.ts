/**
 * Elements whose double-click already means something: a press there edits,
 * selects text, or works a control. `data-lk-lightbox-ignore` is the opt-out
 * for anything else.
 */
const OWN_DOUBLE_CLICK = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="separator"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[data-lk-lightbox-ignore]',
].join(',');

/** Whether a double-click that reached `root` should open its lightbox:
 *  nothing handled it first, and it did not land on a control. */
export function opensLightbox(
  event: { target: EventTarget | null; defaultPrevented: boolean },
  root: Element,
): boolean {
  if (event.defaultPrevented) return false;
  const target = event.target;
  if (!(target instanceof Element)) return true;
  const owner = target.closest(OWN_DOUBLE_CLICK);
  return owner === null || !root.contains(owner);
}

/**
 * Marks everything outside `keep` inert — every sibling of each kept element
 * and of each of their ancestors, up to the body — and returns the undo.
 * Leaves alone what was already inert, so the undo cannot clear someone
 * else's.
 */
export function inertOutside(keep: readonly Element[]): () => void {
  const path = new Set<Element>();
  for (const el of keep) {
    for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
      path.add(node);
    }
  }
  const marked: Element[] = [];
  for (const node of path) {
    const parent: Element | null = node.parentElement;
    if (!parent) continue;
    for (const sibling of Array.from(parent.children)) {
      if (path.has(sibling) || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      marked.push(sibling);
    }
  }
  return () => {
    for (const sibling of marked) sibling.removeAttribute('inert');
  };
}

/**
 * Lifts `stack` into the top layer in order, so the first ends up lowest, and
 * returns the undo. The first carries the dimming. Every member but `self` is
 * marked a layer, which the stylesheet stretches over the window. Does nothing
 * where the browser has no popover support.
 */
export function liftStack(stack: readonly HTMLElement[], self: HTMLElement): () => void {
  if (typeof self.showPopover !== 'function') return () => {};
  stack.forEach((el, i) => {
    el.setAttribute('popover', 'manual');
    if (el !== self) el.setAttribute('data-lk-lightbox-layer', '');
    if (i === 0) el.setAttribute('data-lk-lightbox-scrim', '');
    el.showPopover();
  });
  return () => {
    for (const el of [...stack].reverse()) {
      if (el.matches(':popover-open')) el.hidePopover();
      el.removeAttribute('popover');
      el.removeAttribute('data-lk-lightbox-layer');
      el.removeAttribute('data-lk-lightbox-scrim');
    }
  };
}
