/** Whether a key or a paste landed in a modal dialog that the canvas sits behind. */

const DIALOG = '[role="dialog"], [role="alertdialog"]';

/** True for a native `<dialog>` opened with `showModal()`. */
function isModalDialog(el: Element): boolean {
  if (el.tagName !== 'DIALOG') return false;
  try {
    return el.matches(':modal');
  } catch {
    // An engine without `:modal` has no modal `<dialog>` to find.
    return false;
  }
}

/** True when `el` is hidden from interaction the way a modal hides the page behind it. */
function hiddenBehind(el: Element): boolean {
  return el.closest('[inert], [aria-hidden="true"]') !== null;
}

/**
 * True when `target` sits inside an open modal dialog that `canvas` is not inside: an ARIA
 * dialog with `aria-modal="true"`, a native `<dialog>` opened modally, or an ARIA dialog that
 * has made the canvas inert or `aria-hidden`, as React Aria's modals do in place of `aria-modal`.
 * A canvas inside the dialog keeps its keys.
 */
export function inModalOver(target: EventTarget | null, canvas: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false;
  for (let el: Element | null = target; el; el = el.parentElement) {
    const aria = el.matches(DIALOG);
    if (!aria && el.tagName !== 'DIALOG') continue;
    if (canvas && el.contains(canvas)) return false;
    if (isModalDialog(el)) return true;
    if (aria && (el.getAttribute('aria-modal') === 'true' || (canvas !== null && hiddenBehind(canvas)))) return true;
  }
  return false;
}
