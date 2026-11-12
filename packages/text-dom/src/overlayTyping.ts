/**
 * Text entering the edit overlay. The browser inserts a typed character
 * itself, which keeps the keystroke on its undo stack and lets input that
 * names its own range (a text replacement, the double-space period) land
 * there. The hook inserts by hand only where the browser would pick the wrong
 * run: under an armed style, and at a caret between two run spans.
 *
 * A paste or a drop is never the browser's to insert: it would land as
 * whatever markup the clipboard held. It is read into runs and written
 * through them.
 */

import { runsToPlainText, supersededKey, type RunStylePatch, type StyledRun } from '@weasel-js/text';
import { domPositionToCharOffset, domToRuns, normalizeSmallCaps, type OverlayRunBase } from './domRuns';
import { readSelectionOffsets, selectOffsets, writeRunsPreservingSelection } from './overlaySelection';
import { withArmed } from './armedStyle';
import { clipboardRuns } from './pasteRuns';
import { replaceRunRange, runStyleAt } from './runSplice';
import type { TextEditSelection } from './textEditTypes';

/** Put small-caps letters back in the pieces their case belongs in after
 *  an edit, keeping the caret. Never mid-composition: rewriting the DOM
 *  under an IME ends the composition. */
function resplitSmallCaps(overlay: HTMLElement, base: OverlayRunBase, e?: Event): void {
  if (e instanceof InputEvent && e.isComposing) return;
  const at = readSelectionOffsets(overlay);
  if (normalizeSmallCaps(overlay, base) && at) selectOffsets(overlay, at.start, at.end);
}

/** Whether `ie` names a range of its own to replace, apart from a collapsed caret. */
function namesItsRange(ie: InputEvent, caret: Range): boolean {
  const target = ie.getTargetRanges?.()[0];
  return target !== undefined && caret.collapsed && !target.collapsed;
}

/** The characters `ie` replaces: the range it names, else the selection. */
function replacedOffsets(overlay: HTMLElement, ie: InputEvent, host: TypingHost): TextEditSelection | null {
  const target = ie.getTargetRanges?.()[0];
  if (target && overlay.contains(target.startContainer) && overlay.contains(target.endContainer)) {
    const a = domPositionToCharOffset(overlay, target.startContainer, target.startOffset);
    const b = domPositionToCharOffset(overlay, target.endContainer, target.endOffset);
    return { start: Math.min(a, b), end: Math.max(a, b) };
  }
  return readSelectionOffsets(overlay) ?? host.lastRange();
}

/**
 * `pasted` styled for where it lands: the run it joins and any armed style
 * underneath, its own emphasis on top.
 */
function styledForRange(
  pasted: readonly StyledRun[], runs: readonly StyledRun[], at: TextEditSelection, pending: RunStylePatch,
): StyledRun[] {
  // Over a selection, the first character replaced; at a caret, the one before it.
  const base = withArmed(runStyleAt(runs, at.start === at.end ? at.start : at.start + 1), pending);
  return pasted.map((run) => {
    const styled: Record<string, unknown> = { ...base, ...run };
    const superseded = supersededKey(run);
    if (superseded !== undefined) delete styled[superseded];
    return styled as unknown as StyledRun;
  });
}

const PASTES: ReadonlySet<string> = new Set(['insertFromPaste', 'insertFromDrop']);

/** What the typing handlers read from, and report to, the edit that owns the overlay. */
export interface TypingHost {
  /** The style armed for the next character; no keys when none is. */
  pending: () => RunStylePatch;
  /** The node style run spans are split by. */
  base: () => OverlayRunBase;
  /** The last range published inside the overlay, for when the DOM selection has left it. */
  lastRange: () => TextEditSelection | null;
  /** The runs were rewritten with new text in them, any armed style spent, and the caret now sits at `caret`. */
  onWritten: (caret: number) => void;
  /** The overlay's text changed, by the browser's hand or this module's. */
  onEdited: () => void;
}

/** The overlay's `beforeinput`, `input` and composition listeners. */
export function typingHandlers(overlay: HTMLElement, host: TypingHost): {
  onBeforeInput: (ie: InputEvent) => void;
  onInput: (e: Event) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
} {
  const edited = (e?: Event): void => {
    resplitSmallCaps(overlay, host.base(), e);
    host.onEdited();
  };

  const onPaste = (ie: InputEvent): void => {
    // An engine that hands the event no data inserts for itself.
    const at = ie.dataTransfer ? replacedOffsets(overlay, ie, host) : null;
    if (!ie.dataTransfer || !at) return;
    ie.preventDefault();
    const pasted = clipboardRuns(ie.dataTransfer);
    if (pasted.length === 0) return;
    const runs = domToRuns(overlay);
    const next = replaceRunRange(runs, at.start, at.end, styledForRange(pasted, runs, at, host.pending()));
    const after = at.start + runsToPlainText(pasted).length;
    writeRunsPreservingSelection(overlay, next, after, after, host.base());
    host.onWritten(after);
    host.onEdited();
  };

  const onBeforeInput = (ie: InputEvent): void => {
    if (PASTES.has(ie.inputType)) { onPaste(ie); return; }
    if (ie.inputType !== 'insertText' || !ie.data) return;
    const sel = window.getSelection();
    const caret = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (caret && namesItsRange(ie, caret)) return;

    // A browser types into the text node holding the caret, which is the run `runStyleAt` names. Anywhere else
    // it would pick a span of its own, so the character is written through the runs: under an armed style, and at
    // a caret between two run spans or in an overlay with no text yet, where it takes the run before it, as the
    // caret's `rangeStyle` reports. Rebuilt from the runs rather than spliced into the DOM: `insertNode` inside a
    // run span nests a new span within it, and `domToRuns` reads styling down the ancestor chain.
    const pending = host.pending();
    const armed = Object.keys(pending).length > 0;
    if (!armed && (!caret || !caret.collapsed || caret.startContainer.nodeType === Node.TEXT_NODE)) return;
    if (!armed && !overlay.contains(caret!.startContainer)) return;
    const at = readSelectionOffsets(overlay) ?? host.lastRange();
    if (!at || at.start !== at.end) return;
    ie.preventDefault();
    const runs = domToRuns(overlay);
    const next = replaceRunRange(runs, at.start, at.start, styledForRange([{ text: ie.data }], runs, at, pending));
    const after = at.start + ie.data.length;
    writeRunsPreservingSelection(overlay, next, after, after, host.base());
    host.onWritten(after);
    host.onEdited();
  };

  /** Where a composition opened and the style armed there: the caret moving
   *  as the input method types abandons what is armed before it commits. */
  let composing: { start: number; pending: RunStylePatch } | null = null;

  const onCompositionStart = (): void => {
    const pending = host.pending();
    const at = readSelectionOffsets(overlay) ?? host.lastRange();
    composing = at && Object.keys(pending).length > 0 ? { start: at.start, pending } : null;
  };

  // Chrome sends the composition's last `input` while it is still composing,
  // so this is the first point the DOM may be rewritten.
  const onCompositionEnd = (): void => {
    const armed = composing;
    composing = null;
    const end = readSelectionOffsets(overlay)?.end;
    if (!armed || end === undefined || end <= armed.start) { edited(); return; }
    const at = { start: armed.start, end: armed.start };
    const typed = runsToPlainText(domToRuns(overlay)).slice(armed.start, end);
    const runs = replaceRunRange(domToRuns(overlay), armed.start, end, []);
    const next = replaceRunRange(runs, armed.start, armed.start, styledForRange([{ text: typed }], runs, at, armed.pending));
    writeRunsPreservingSelection(overlay, next, end, end, host.base());
    host.onWritten(end);
    host.onEdited();
  };

  return { onBeforeInput, onInput: edited, onCompositionStart, onCompositionEnd };
}
