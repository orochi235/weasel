/**
 * What the edit overlay holds when an edit opens, and the one character it can
 * come to hold that is not the node's text.
 *
 * A browser draws no empty last line for text that ends in a line break, so
 * when an edit leaves the caret on one it keeps a second newline there: the
 * caret holder, which reading the text back drops. Text seeded already ending
 * in a break is different. The canvas draws no last line for it either, and
 * Chromium takes the break that is there as the holder and adds none, so that
 * newline is the node's own and stays until an edit removes it.
 */

import { isHardLineBreak, runsToPlainText, type StyledRun } from '@weasel-js/text';
import { appendOverlayText, domToRuns, runsToDom, type OverlayRunBase } from './domRuns';

const endsInBreak = (text: string): boolean =>
  text.length > 0 && isHardLineBreak(text.charCodeAt(text.length - 1));

/** Which trailing newline of an overlay's text, if any, is the browser's. */
export interface CaretHolder {
  /** Call after anything that edits the overlay's text. */
  edited(overlay: HTMLElement): void;
  /** `runs` as read from the overlay, without the holder. */
  trim(runs: StyledRun[]): StyledRun[];
}

/**
 * Fill `overlay` with a node's text: its runs when it has any, one run when
 * small caps needs its lowercase in pieces only a run span holds, and bare text
 * otherwise.
 */
export function seedOverlay(
  overlay: HTMLElement,
  text: string,
  runs: readonly StyledRun[] | undefined,
  base: OverlayRunBase,
): CaretHolder {
  const styled = runs !== undefined && runs.length > 0;
  if (styled) runsToDom(runs, overlay, base);
  else if (base.fontVariantCaps === 'small-caps') runsToDom([{ text }], overlay, base);
  // Not `innerText`, which turns each newline into a `<br>` the caret
  // walkers cannot count and U+2028 into a space.
  else appendOverlayText(overlay, text);

  let ownBreak = endsInBreak(styled ? runsToPlainText(runs) : text);
  return {
    edited(el) {
      if (ownBreak && !endsInBreak(runsToPlainText(domToRuns(el)))) ownBreak = false;
    },
    trim: (read) => (ownBreak ? read : trimCaretHolder(read)),
  };
}

/** An empty run left behind is dropped: it would answer `runsCarryStyling` by existing. */
function trimCaretHolder(runs: StyledRun[]): StyledRun[] {
  const last = runs[runs.length - 1];
  if (last === undefined || !last.text.endsWith('\n')) return runs;
  const trimmed = { ...last, text: last.text.slice(0, -1) };
  const head = runs.slice(0, -1);
  return trimmed.text === '' ? head : [...head, trimmed];
}
