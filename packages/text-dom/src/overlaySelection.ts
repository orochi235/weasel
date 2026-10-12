/** The DOM selection inside the edit overlay, as character offsets and back. */

import type { StyledRun } from '@weasel-js/text';
import { charOffsetToDomPosition, domPositionToCharOffset, runsToDom, type OverlayRunBase } from './domRuns';
import type { TextEditSelection } from './textEditTypes';

/**
 * Character offsets of the current DOM selection within `overlay`, or `null`
 * when there is no selection or it lies outside the overlay. The one
 * DOM→offset conversion in the hook; everything that needs offsets goes
 * through here.
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
 * Replace the overlay's contents with `runs` and put the caret back on
 * `[start, end)`. Rewriting the DOM destroys the selection, and losing it
 * after every styling change would mean re-selecting the word to apply a
 * second style — so this is the only way styling writes back.
 *
 * The caret is **not** restored while focus sits in a text-entry control.
 * Browsers route editing commands by selection rather than by focus, so a
 * document selection put back inside the contenteditable while a bar's
 * number field has focus means the very Enter that committed that field also
 * runs its `insertParagraph` default over the restored range — replacing the
 * text that was just styled with a line break. (Observed in Chrome.)
 *
 * Focus on a *button* is the opposite case and must still restore: toggling
 * bold, then italic, then underline is one flow over one selection, and
 * clicking a toolbar button does take focus. Buttons turn keystrokes into
 * clicks, not into editing commands, so the range is safe there.
 *
 * The hook remembers the range as character offsets either way, so a skipped
 * restore costs the highlight, never the target.
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
