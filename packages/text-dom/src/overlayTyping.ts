/**
 * Text entering the edit overlay. The browser inserts a typed character
 * itself, which keeps the keystroke on its undo stack and lets input that
 * names its own range (a text replacement, the double-space period) land
 * there. The hook inserts by hand only where the character has to open a run
 * of its own: under an armed style, and at a caret between two run spans.
 *
 * A paste or a drop is never the browser's to insert: it would land as
 * whatever markup the clipboard held. It is read into runs and written
 * through them.
 */

import { runsToPlainText, supersededKey, type RunStylePatch, type StyledRun } from '@weasel-js/text';
import { domPositionToCharOffset, domToRuns, normalizeSmallCaps, type OverlayRunBase } from './domRuns';
import { readSelectionOffsets, selectOffsets, writeRunsPreservingSelection } from './overlaySelection';
import { clipboardRuns } from './pasteRuns';
import { replaceRunRange, runStyleAt } from './runSplice';
import type { TextEditSelection } from './textEditTypes';

/**
 * Put the caret *between* two run spans when `offset` falls on the boundary
 * of one, rather than at the same offset inside the left span's text node.
 * A caret inside a span has the next character absorbed by that run —
 * otherwise the character after a superscript is superscript too. Leaves the
 * selection alone when the offset falls mid-run.
 */
function placeCaretBetweenRuns(overlay: HTMLElement, runs: readonly StyledRun[], offset: number): void {
  let acc = 0;
  let index = -1;
  for (let i = 0; i < runs.length; i++) {
    acc += runs[i].text.length;
    if (acc === offset) { index = i; break; }
    if (acc > offset) return;
  }
  const span = index >= 0 ? overlay.children[index] : null;
  const sel = window.getSelection();
  if (!span || !sel) return;
  const range = document.createRange();
  range.setStartAfter(span);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Put small-caps letters back in the pieces their case belongs in after
 *  an edit, keeping the caret. Never mid-composition: rewriting the DOM
 *  under an IME ends the composition. */
function resplitSmallCaps(overlay: HTMLElement, e?: Event): void {
  if (e instanceof InputEvent && e.isComposing) return;
  const at = readSelectionOffsets(overlay);
  if (normalizeSmallCaps(overlay) && at) selectOffsets(overlay, at.start, at.end);
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
  const base: Record<string, unknown> = { ...runStyleAt(runs, at.start === at.end ? at.start : at.start + 1) };
  for (const [key, value] of Object.entries(pending)) {
    if (value === undefined || value === false) delete base[key];
    else base[key] = value;
  }
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

/** The overlay's `beforeinput` and `input` listeners. */
export function typingHandlers(overlay: HTMLElement, host: TypingHost): {
  onBeforeInput: (ie: InputEvent) => void;
  onInput: (e: Event) => void;
} {
  const edited = (e?: Event): void => {
    resplitSmallCaps(overlay, e);
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

    const pending = host.pending();
    if (Object.keys(pending).length > 0) {
      // Rebuild from the runs rather than splicing a span into the DOM.
      // `insertNode` at a caret sitting inside a run span nests the new
      // span *within* it, and `domToRuns` reads styling down the ancestor
      // chain — so a pending style that has to shed the surrounding run's
      // flag would inherit it.
      const at = readSelectionOffsets(overlay) ?? host.lastRange();
      if (!at || at.start !== at.end) return;
      ie.preventDefault();
      const typed = { ...pending, text: ie.data } as StyledRun;
      const next = replaceRunRange(domToRuns(overlay), at.start, at.start, [typed]);
      const after = at.start + ie.data.length;
      writeRunsPreservingSelection(overlay, next, after, after, host.base());
      placeCaretBetweenRuns(overlay, next, after);
      host.onWritten(after);
      host.onEdited();
      return;
    }

    // A caret between two run spans, or in an overlay with no text yet. A
    // browser types into the span before it; a text node of its own keeps
    // the character out of that run, and the caret left inside the node
    // hands the characters after it back to the browser.
    if (!sel || !caret || !caret.collapsed || caret.startContainer.nodeType === Node.TEXT_NODE) return;
    if (!overlay.contains(caret.startContainer)) return;
    ie.preventDefault();
    const textNode = document.createTextNode(ie.data);
    caret.insertNode(textNode);
    sel.collapse(textNode, ie.data.length);
    edited();
  };

  return { onBeforeInput, onInput: edited };
}
