import { tabSort, tabStep } from '@weasel-js/ui-input';
import { type FocusScope, type FocusScopeOptions } from '@weasel-js/ui-logic';

const TABBABLE = 'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';

/** Whether a closed `<details>` hides `el`: everything in one but its own summary. */
const inClosedDetails = (el: HTMLElement): boolean => {
  for (let d = el.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])') ?? null) {
    if (!d.querySelector(':scope > summary')?.contains(el)) return true;
  }
  return false;
};

const isTabbable = (el: HTMLElement): boolean =>
  el.tabIndex >= 0 && !el.matches(':disabled') && el.closest('[hidden], [inert]') === null
  && (el as HTMLInputElement).type !== 'hidden' && !inClosedDetails(el);

/** `els` with each named radio group down to the one radio Tab stops on: the checked one, else the first. */
function oneRadioPerGroup(els: readonly HTMLElement[]): HTMLElement[] {
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
    return el === (group.find((r) => r.checked) ?? group[0]);
  });
}

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/**
 * Keyboard focus inside `root` as a headless `FocusScope`, the contract a HUD's widget focus answers too. Its
 * targets are the elements under `root`; Tab order is the browser's — a positive `tabindex` first, ascending, then
 * document order — over those not disabled, hidden, inert or in a closed `<details>`, and one radio per named group.
 * Holds no state: it reads and moves the DOM's own focus.
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
    oneRadioPerGroup([...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(isTabbable)),
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
      const order = tabOrder();
      for (let next = tabStep(order, from, direction, follows); next; next = tabStep(order, next, direction)) {
        if (focusEl(next, options?.visible ?? true)) return next;
      }
      focusedIn()?.blur();
      return null;
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
