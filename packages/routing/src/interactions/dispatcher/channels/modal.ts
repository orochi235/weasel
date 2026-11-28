import { isElement } from '@weasel-js/gestures';
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

const HIDDEN = '[inert], [aria-hidden="true"]';
// Never hidden by a modal, so neither shows that one is open.
const INERT_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

/** True when `el` sits in an element hidden from interaction beside one holding `dialog`, as a modal hides the page around it. */
function hiddenBy(dialog: Element, el: Element): boolean {
  for (let a: Element | null = el; a; a = a.parentElement) {
    if (a.matches(HIDDEN) && a.parentElement?.contains(dialog)) return true;
  }
  return false;
}

/** True when everything in the document outside `dialog` is hidden from interaction, and there is something outside it. */
function hiddenOutside(dialog: Element): boolean {
  let outside = 0;
  for (let el: Element = dialog; el.parentElement && el !== el.ownerDocument.body; el = el.parentElement) {
    for (const sib of el.parentElement.children) {
      if (sib === el || INERT_TAGS.has(sib.tagName) || sib.matches('[aria-live]')) continue;
      if (!sib.matches(HIDDEN)) return false;
      outside++;
    }
  }
  return outside > 0;
}

/**
 * True when `target` sits inside an open modal dialog that `canvas` is not inside: an ARIA
 * dialog with `aria-modal="true"`, a native `<dialog>` opened modally, or an ARIA dialog that
 * has made the page around it inert or `aria-hidden`, as React Aria's modals do in place of
 * `aria-modal`: the canvas, through an element beside one holding the dialog, or with no canvas,
 * everything outside the dialog. A canvas inside the dialog keeps its keys.
 */
export function inModalOver(target: EventTarget | null, canvas: HTMLElement | null): boolean {
  if (!isElement(target)) return false;
  for (let el: Element | null = target; el; el = el.parentElement) {
    const aria = el.matches(DIALOG);
    if (!aria && el.tagName !== 'DIALOG') continue;
    if (canvas && el.contains(canvas)) return false;
    if (isModalDialog(el)) return true;
    if (aria && (el.getAttribute('aria-modal') === 'true' || (canvas ? hiddenBy(el, canvas) : hiddenOutside(el)))) return true;
  }
  return false;
}
