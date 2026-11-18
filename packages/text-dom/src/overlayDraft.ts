/**
 * What the overlay holds, as a node takes it — what a commit writes, and what
 * each keystroke or restyle reports as a draft — and handing it to the host:
 * a draft when it changed, a commit through the host's options.
 */
import { hasStyledRun, runsToPlainText, type StyledRun, type TextStyle } from '@weasel-js/text';
import { domToRuns, type OverlayRunBase } from './domRuns';
import { seedOverlay, type CaretHolder } from './overlaySeed';
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
): TextEditCommit {
  const runs = holder?.trim(read) ?? read;
  const inPlay = (priorRuns != null && priorRuns.length > 0) || hasStyledRun(runs);
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

/** Write a finished edit through `opts`: its `onChange` where there is one, else each setter it has. */
export function writeEdit(
  opts: Pick<UseTextEditOptions, 'onChange' | 'setRuns' | 'setStyle' | 'setText'>,
  id: string,
  edit: TextEditCommit,
): void {
  if (opts.onChange) return opts.onChange(id, edit);
  if (edit.style) opts.setStyle?.(id, edit.style);
  opts.setText?.(id, edit.text);
  if (opts.setRuns && edit.runs) opts.setRuns(id, edit.runs);
}

/** One edit's draft, from the overlay as it was seeded: what it reads back as, and what it has sent. */
export interface EditDraft {
  /** The overlay's caret holder. */
  readonly holder: CaretHolder;
  /** The overlay's draft, with `style` riding along, when it differs from the last one sent; `null` when not. */
  changed(overlay: HTMLElement, style: TextStyle | null): TextEditDraft | null;
  /** What committing the overlay writes, or `null` when the edit changed nothing. */
  finished(overlay: HTMLElement, style: TextStyle | null): TextEditCommit | null;
}

/** Seed `overlay` with a node's `text` and `runs`, and open its draft. */
export function seedDraft(
  overlay: HTMLElement,
  text: string,
  runs: readonly StyledRun[] | undefined,
  base: OverlayRunBase,
): EditDraft {
  const holder = seedOverlay(overlay, text, runs, base);
  // What the overlay read back as when the edit opened, before any input.
  const opened = JSON.stringify(domToRuns(overlay));
  // Before the first draft is sent, the overlay as it opened.
  const sent = { current: JSON.stringify(overlayDraft(domToRuns(overlay), holder, runs)) };
  return {
    holder,
    changed(el, style) {
      const draft = overlayDraft(domToRuns(el), holder, runs, style);
      return draftChanged(sent, draft) ? draft : null;
    },
    finished(el, style) {
      // Runs are written when the node already had them — or stale styling
      // survives a Cmd-B that turned it off — or when the edit produced
      // styling. A plain-text edit of a plain-text node commits text alone.
      const read = domToRuns(el);
      // Compared untrimmed: a seeded trailing newline reads back the same at
      // both ends, where the trimmed form would differ from the node's text.
      if (!style && JSON.stringify(read) === opened) return null;
      return overlayDraft(read, holder, runs, style);
    },
  };
}
