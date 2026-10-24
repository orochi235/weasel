/** The DOM selection inside the edit overlay, as character offsets and back, and handing focus back to the overlay. */

import type { StyledRun } from '@weasel-js/text';
import { charOffsetToDomPosition, domPositionToCharOffset, runsToDom, type OverlayRunBase } from './domRuns';
import type { TextEditSelection } from './textEditTypes';

/**
 * Character offsets of the current DOM selection within `overlay`, or `null`
 * when there is no selection or it lies outside the overlay.
 */
export function readSelectionOffsets(overlay: HTMLElement): TextEditSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!overlay.contains(range.startContainer) || !overlay.contains(range.endContainer)) {
    return null;
  }
  // `Range` boundary points are already in document order, so this is the
  // normalization for a backwards drag — anchor/focus are not consulted.
  const start = domPositionToCharOffset(overlay, range.startContainer, range.startOffset);
  const end = domPositionToCharOffset(overlay, range.endContainer, range.endOffset);
  return start <= end ? { start, end } : { start: end, end: start };
}

/** Put the DOM selection on the characters `[start, end)` of `overlay`. */
export function selectOffsets(overlay: HTMLElement, start: number, end: number): void {
  const a = charOffsetToDomPosition(overlay, start);
  const b = charOffsetToDomPosition(overlay, end);
  const sel = window.getSelection();
  if (!a || !b || !sel) return;
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Replace the overlay's contents with `runs` and put the selection back on
 * `[start, end)`, which rewriting the DOM destroys.
 *
 * The selection is **not** restored while focus sits in a text-entry control.
 * Browsers route editing commands by selection rather than by focus, so with
 * the range restored, the Enter that commits a number field also runs
 * `insertParagraph` over it — replacing the text that was just styled with a
 * line break. (Observed in Chrome.) Focus on a *button* still restores:
 * buttons turn keystrokes into clicks, not into editing commands.
 */
export function writeRunsPreservingSelection(
  overlay: HTMLElement,
  runs: readonly StyledRun[],
  start: number,
  end: number,
  base: OverlayRunBase,
): void {
  const active = document.activeElement;
  const inTextEntry =
    active !== overlay &&
    !overlay.contains(active) &&
    (active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable));
  runsToDom(runs, overlay, base);
  if (!inTextEntry) selectOffsets(overlay, start, end);
}

/**
 * Return focus to the overlay after a styling arrived from editor chrome: a
 * control that took focus to be clicked still holds it when the patch lands,
 * so the next keystroke would go to that button.
 *
 * Two things are left holding focus deliberately: a text entry in the chrome
 * (the user is still typing a font size) and anything inside an open dialog,
 * which is where a color picker's live `onChange` fires from.
 */
export function restoreOverlayFocus(overlay: HTMLElement, range: TextEditSelection): void {
  const active = document.activeElement;
  if (active === overlay || overlay.contains(active)) return;
  if (
    active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || (active instanceof HTMLElement && active.isContentEditable)
    || (active instanceof Element && active.closest('[role="dialog"]') !== null)
  ) return;
  overlay.focus();
  selectOffsets(overlay, range.start, range.end);
}

/** Whether two published ranges are the same, either being none. */
export function sameSelection(a: TextEditSelection | null, b: TextEditSelection | null): boolean {
  if (a === null || b === null) return a === b;
  return a.start === b.start && a.end === b.end;
}
