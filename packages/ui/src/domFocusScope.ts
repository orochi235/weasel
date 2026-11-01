import { tabSort, tabStep, type FocusScope, type FocusScopeOptions } from '@weasel-js/ui-logic';

const TABBABLE = 'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';

const isTabbable = (el: HTMLElement): boolean =>
  el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.closest('[hidden], [inert]') === null
  && (el as HTMLInputElement).type !== 'hidden';

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/**
 * Keyboard focus inside `root` as a headless `FocusScope`, the contract a HUD's widget focus answers too. Its
 * targets are the elements under `root`; Tab order is the browser's — a positive `tabindex` first, ascending, then
 * document order — over those not disabled, hidden or inert. Holds no state: it reads and moves the DOM's own focus.
 */
export function domFocusScope(root: HTMLElement): FocusScope<HTMLElement> {
  const doc = root.ownerDocument;
  const focusedIn = (): HTMLElement | null => {
    const a = doc.activeElement;
    return a instanceof HTMLElement && root.contains(a) ? a : null;
  };
  const focusEl = (el: HTMLElement, visible: boolean): boolean => {
    el.focus({ focusVisible: visible });
    return doc.activeElement === el;
  };
  const tabOrder = () => tabSort(
    [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(isTabbable),
    (el) => (el.tabIndex > 0 ? el.tabIndex : undefined),
  );

  return {
    get focused() { return focusedIn(); },
    get focusVisible() {
      const f = focusedIn();
      try { return f?.matches(':focus-visible') ?? false; } catch { return false; }
    },
    focus(target: HTMLElement | null, options?: FocusScopeOptions) {
      if (target === null) { focusedIn()?.blur(); return false; }
      return root.contains(target) && focusEl(target, options?.visible ?? false);
    },
    moveFocus(direction, options) {
      const from = focusedIn();
      const next = tabStep(tabOrder(), from, direction, follows);
      if (next) focusEl(next, options?.visible ?? true);
      else from?.blur();
      return next;
    },
    tabOrder,
    subscribeFocus(fn) {
      const onIn = (e: FocusEvent) => { if (e.target instanceof HTMLElement) fn(e.target); };
      const onOut = (e: FocusEvent) => {
        const to = e.relatedTarget;
        if (!(to instanceof Node) || !root.contains(to)) fn(null);
      };
      root.addEventListener('focusin', onIn);
      root.addEventListener('focusout', onOut);
      return () => {
        root.removeEventListener('focusin', onIn);
        root.removeEventListener('focusout', onOut);
      };
    },
  };
}
