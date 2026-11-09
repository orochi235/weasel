import { oneCodePoint } from './oneCodePoint';

/** The `<input>` types a person types text into. An unknown or missing `type` is `text`. */
const TEXT_INPUT_TYPES = new Set([
  'text', 'search', 'email', 'url', 'tel', 'password', 'number',
  'date', 'datetime-local', 'month', 'week', 'time',
]);

/** Returns true when the target takes typed text: a text-entry input, a textarea, or a contenteditable element. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return TEXT_INPUT_TYPES.has((target as HTMLInputElement).type);
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
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** A range input's unmodified navigation keys, and a radio's arrows, which move to the next in its group. */
function stepperOwnsKey(e: KeyboardEvent): boolean {
  if (!(e.target instanceof HTMLInputElement) || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.target.type === 'range') return SELECT_NAVIGATION.has(e.key);
  return e.target.type === 'radio' && ARROWS.has(e.key);
}

function selectOwnsKey(e: KeyboardEvent): boolean {
  if (!(e.target instanceof Element) || e.target.tagName !== 'SELECT') return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  // A one-character `key` is a printable character, which a select reads as type-ahead.
  return SELECT_NAVIGATION.has(e.key) || oneCodePoint(e.key);
}


/**
 * True when the key `e` reports belongs to the control it was typed on: Space
 * or Enter on anything those activate, a `<select>`'s type-ahead
 * characters and navigation keys, a range input's navigation keys, and a
 * radio's arrows. A select claims nothing else, so Delete,
 * Escape, and every modifier chord typed on one are still a page-level
 * listener's to take. A text field is {@link isEditableTarget}'s question,
 * since it owns every key.
 */
export function focusedControlOwnsKey(e: KeyboardEvent): boolean {
  return activatesFocusedControl(e) || selectOwnsKey(e) || stepperOwnsKey(e);
}
