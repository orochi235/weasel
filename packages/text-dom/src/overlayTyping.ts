/**
 * Typed text in the edit overlay. The browser inserts a typed character
 * itself, which keeps the keystroke on its undo stack and lets input that
 * names its own range (a text replacement, the double-space period) land
 * there. The hook inserts by hand only where the character has to open a run
 * of its own: under an armed style, and at a caret between two run spans.
 */

import { applyStyleToRange, type RunStylePatch, type StyledRun } from '@weasel-js/text';
import { domToRuns, normalizeSmallCaps, type OverlayRunBase } from './domRuns';
import { readSelectionOffsets, selectOffsets, writeRunsPreservingSelection } from './overlaySelection';
import type { TextEditSelection } from './textEditTypes';

/**
 * Splice `run` into `runs` at character offset `at`, splitting whichever run
 * spans it. The result is normalized (empty runs dropped, identical
 * neighbors merged) by the same algebra every other write goes through.
 */
function spliceRunAt(runs: readonly StyledRun[], at: number, run: StyledRun): StyledRun[] {
  const out: StyledRun[] = [];
  let pos = 0;
  let placed = false;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (!placed && at <= end) {
      const k = at - pos;
      if (k > 0) out.push({ ...r, text: r.text.slice(0, k) });
      out.push(run);
      if (k < r.text.length) out.push({ ...r, text: r.text.slice(k) });
      placed = true;
    } else {
      out.push({ ...r });
    }
    pos = end;
  }
  if (!placed) out.push(run);
  // An empty patch over an empty range: this is the array-wide normalization
  // pass, not a styling.
  return applyStyleToRange(out, 0, 0, {});
}

/**
 * Put the caret *between* two run spans when `offset` falls on the boundary
 * of one, rather than at the same offset inside the left span's text node.
 *
 * The two positions are the same character offset and browsers report them
 * identically, but they type differently: a caret inside a span has the next
 * character absorbed by that run, and one between spans starts a fresh one.
 * That distinction is the whole point after a pending style has just been
 * committed to its own run — otherwise the character after a superscript is
 * superscript too. Leaves the selection alone when the offset falls mid-run,
 * where there is no boundary to prefer.
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

/** What the typing handlers read from, and report to, the edit that owns the overlay. */
export interface TypingHost {
  /** The style armed for the next character; no keys when none is. */
  pending: () => RunStylePatch;
  /** The node style run spans are split by. */
  base: () => OverlayRunBase;
  /** The last range published inside the overlay, for when the DOM selection has left it. */
  lastRange: () => TextEditSelection | null;
  /** The armed style went into a run of its own, and the caret now sits at `caret`. */
  onPendingTyped: (caret: number) => void;
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

  const onBeforeInput = (ie: InputEvent): void => {
    if (ie.inputType !== 'insertText' || !ie.data) return;
    const sel = window.getSelection();
    const caret = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (caret && namesItsRange(ie, caret)) return;

    const pending = host.pending();
    if (Object.keys(pending).length > 0) {
      // Rebuild from the runs rather than splicing a span into the DOM.
      // `insertNode` at a caret sitting inside a run span nests the new
      // span *within* it, and `domToRuns` reads styling down the ancestor
      // chain — so a pending style that has to escape the surrounding run
      // (the `false` armed after a node-flag rewrite) would inherit exactly
      // the flag it exists to shed. Going through the algebra also gets
      // every run field for free, with no CSS written here.
      const at = readSelectionOffsets(overlay) ?? host.lastRange();
      if (!at || at.start !== at.end) return;
      ie.preventDefault();
      const next = spliceRunAt(domToRuns(overlay), at.start, { ...pending, text: ie.data } as StyledRun);
      const after = at.start + ie.data.length;
      writeRunsPreservingSelection(overlay, next, after, after, host.base());
      placeCaretBetweenRuns(overlay, next, after);
      host.onPendingTyped(after);
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
