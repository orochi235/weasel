/**
 * What the overlay holds, as a node takes it: what a commit writes, and what
 * each keystroke or restyle reports as a draft.
 */
import { runsCarryStyling, runsToPlainText, type StyledRun, type TextStyle } from '@weasel-js/text';
import type { CaretHolder } from './overlaySeed';
import type { TextEditCommit, TextEditDraft, UseTextEditOptions } from './textEditTypes';

/**
 * `read` — the overlay's runs as `domToRuns` gives them — less its caret
 * holder, as text, with the runs when they are in play: the node had some, or
 * the edit produced styling. A plain-text edit of a plain-text node is text alone.
 * `style`, the node style the edit rewrote, rides along where there is one.
 */
export function overlayDraft(
  read: StyledRun[],
  holder: CaretHolder | null,
  priorRuns: readonly StyledRun[] | undefined,
  style: TextStyle | null = null,
): { text: string; runs?: StyledRun[]; style?: TextStyle } {
  const runs = holder?.trim(read) ?? read;
  const inPlay = (priorRuns != null && priorRuns.length > 0) || runsCarryStyling(runs);
  // Read from the DOM, not `innerText`: a browser applies `text-transform`
  // to what that reports, and a break stand-in reads back as its `\n`.
  const text = runsToPlainText(runs);
  return { text, ...(inPlay ? { runs } : {}), ...(style ? { style } : {}) };
}

/** Whether `draft` differs from the one `sent` holds as JSON, taking it as the one sent when it does. */
export function draftChanged(sent: { current: string }, draft: TextEditDraft): boolean {
  const json = JSON.stringify(draft);
  if (json === sent.current) return false;
  sent.current = json;
  return true;
}

/** Write a finished edit through `opts`: its `commit` where there is one, else each setter it has. */
export function writeEdit(
  opts: Pick<UseTextEditOptions, 'commit' | 'setRuns' | 'setStyle' | 'setText'>,
  id: string,
  edit: TextEditCommit,
): void {
  if (opts.commit) return opts.commit(id, edit);
  if (edit.style) opts.setStyle?.(id, edit.style);
  opts.setText?.(id, edit.text);
  if (opts.setRuns && edit.runs) opts.setRuns(id, edit.runs);
}
