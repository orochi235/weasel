import { tabSort, tabStep } from '@weasel-js/ui-input';
import { type FocusScope, type FocusScopeOptions } from '@weasel-js/ui-logic';

const TABBABLE = 'a[href], area[href], button, input, select, textarea, iframe, summary, audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable="false"])';

/** Whether a closed `<details>` hides `el`: everything in one but its own summary. */
const inClosedDetails = (el: HTMLElement): boolean => {
  for (let d = el.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])') ?? null) {
    if (!d.querySelector(':scope > summary')?.contains(el)) return true;
  }
  return false;
};

/** Whether `el` is drawn: no `display: none` on it or above it, and not `visibility` hidden or collapsed. */
const isRendered = (el: HTMLElement): boolean => {
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  if (view.getComputedStyle(el).visibility !== 'visible') return false;
  for (let at: Element | null = el; at; at = at.parentElement) {
    if (view.getComputedStyle(at).display === 'none') return false;
  }
  return true;
};

/** A player showing its controls takes a Tab stop, though `tabIndex` reads -1 for one with no `tabindex`. */
const tabIndexOf = (el: HTMLElement): number =>
  el.matches('audio[controls]:not([tabindex]), video[controls]:not([tabindex])') ? 0 : el.tabIndex;

const isTabbable = (el: HTMLElement): boolean =>
  tabIndexOf(el) >= 0 && !el.matches(':disabled') && el.closest('[hidden], [inert]') === null
  && (el as HTMLInputElement).type !== 'hidden' && !inClosedDetails(el) && isRendered(el);

/** `els` with each named radio group down to the one radio Tab stops on: the checked one, else the first going
 *  forward and the last going back, as Shift+Tab enters it. */
function oneRadioPerGroup(els: readonly HTMLElement[], direction: 'next' | 'prev'): HTMLElement[] {
  const groups = new Map<string, HTMLInputElement[]>();
  const keyOf = (el: HTMLElement): string | null => {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || el.name === '') return null;
    const form = el.form;
    return `${form ? [...el.ownerDocument.forms].indexOf(form) : -1}\u0000${el.name}`;
  };
  for (const el of els) {
    const key = keyOf(el);
    if (key !== null) groups.set(key, [...(groups.get(key) ?? []), el as HTMLInputElement]);
  }
  return els.filter((el) => {
    const key = keyOf(el);
    if (key === null) return true;
    const group = groups.get(key)!;
    return el === (group.find((r) => r.checked) ?? (direction === 'next' ? group[0] : group[group.length - 1]));
  });
}

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/**
 * Keyboard focus inside `root` as a headless `FocusScope`, the contract a HUD's widget focus answers too. Its
 * targets are the elements under `root`; Tab order is the browser's — a positive `tabindex` first, ascending, then
 * document order — over those not disabled, hidden, inert, unrendered (`display: none`, `visibility: hidden`) or
 * in a closed `<details>`, and one radio per named group: its checked one, else the first, or the last going back. Holds no state: it reads and moves the DOM's own focus.
 */
export function createDomFocusScope(root: HTMLElement): FocusScope<HTMLElement> {
  const doc = root.ownerDocument;
  const focusedIn = (): HTMLElement | null => {
    const a = doc.activeElement;
    return a instanceof HTMLElement && root.contains(a) ? a : null;
  };
  const focusEl = (el: HTMLElement, visible: boolean): boolean => {
    el.focus({ focusVisible: visible });
    return doc.activeElement === el;
  };
  const orderFor = (direction: 'next' | 'prev') => tabSort(
    oneRadioPerGroup([...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(isTabbable), direction),
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
    // A target that will not take focus is passed over, as Tab passes it, so what comes back is what `focused` reads.
    moveFocus(direction, options) {
      const from = focusedIn();
      const order = orderFor(direction);
      for (let next = tabStep(order, from, direction, follows); next; next = tabStep(order, next, direction)) {
        if (focusEl(next, options?.visible ?? true)) return next;
      }
      focusedIn()?.blur();
      return null;
    },
    tabOrder: (direction = 'next') => orderFor(direction),
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
