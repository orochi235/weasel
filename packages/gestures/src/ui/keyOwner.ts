/** Returns true when the target takes typed text: an input, a textarea, or a contenteditable element. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((target as HTMLElement).isContentEditable) return true;
  const ce = target.getAttribute('contenteditable');
  return ce === 'true' || ce === '';
}

const ACTIVATED_BY_KEY = [
  'button', 'a[href]', 'summary', 'select',
  'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
  'input[type="checkbox"]', 'input[type="radio"]',
  '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="switch"]',
  '[role="menuitem"]', '[role="tab"]', '[role="option"]',
].join(', ');

/**
 * True when `e` is Space or Enter on a focused control those keys activate — a
 * button, a link, a checkbox. The key is that control's, so a page-level
 * listener that claims it cancels the control's own activation.
 */
export function activatesFocusedControl(e: KeyboardEvent): boolean {
  if (e.key !== ' ' && e.key !== 'Enter') return false;
  return e.target instanceof Element && e.target.matches(ACTIVATED_BY_KEY);
}

const SELECT_NAVIGATION = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

function selectOwnsKey(e: KeyboardEvent): boolean {
  if (!(e.target instanceof Element) || e.target.tagName !== 'SELECT') return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  // A one-character `key` is a printable character, which a select reads as type-ahead.
  return SELECT_NAVIGATION.has(e.key) || e.key.length === 1;
}

/**
 * True when the key `e` reports belongs to the control it was typed on: Space
 * or Enter on anything those activate, and a `<select>`'s type-ahead
 * characters and navigation keys. A select claims nothing else, so Delete,
 * Escape, and every modifier chord typed on one are still a page-level
 * listener's to take. A text field is {@link isEditableTarget}'s question,
 * since it owns every key.
 */
export function focusedControlOwnsKey(e: KeyboardEvent): boolean {
  return activatesFocusedControl(e) || selectOwnsKey(e);
}
