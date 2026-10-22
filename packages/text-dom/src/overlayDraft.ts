/**
 * What the overlay holds, as a node takes it: what a commit writes, and what
 * each keystroke reports as a draft.
 */
import { runsCarryStyling, runsToPlainText, type StyledRun } from '@weasel-js/text';
import type { CaretHolder } from './overlaySeed';

/**
 * `read` — the overlay's runs as `domToRuns` gives them — less its caret
 * holder, as text, with the runs when they are in play: the node had some, or
 * the edit produced styling. A plain-text edit of a plain-text node is text alone.
 */
export function overlayDraft(
  read: StyledRun[],
  holder: CaretHolder | null,
  priorRuns: readonly StyledRun[] | undefined,
): { text: string; runs?: StyledRun[] } {
  const runs = holder?.trim(read) ?? read;
  const inPlay = (priorRuns != null && priorRuns.length > 0) || runsCarryStyling(runs);
  // Read from the DOM, not `innerText`: a browser applies `text-transform`
  // to what that reports, and a break stand-in reads back as its `\n`.
  const text = runsToPlainText(runs);
  return inPlay ? { text, runs } : { text };
}
