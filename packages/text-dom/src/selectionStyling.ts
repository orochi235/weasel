/** The styling commands an edit takes from shortcuts and chrome: a patch over the selection, or a toggle of one flag. */
import { useCallback } from 'react';
import {
  applyStyleToRange, rangeWeight, setFlagOverRange, styleAtRange, styleHasFlag, unboldPatch,
  type FlagKey, type RangeStyle, type RunStylePatch, type TextStyle,
} from '@weasel-js/text';
import { armedOver, armPatch } from './armedStyle';
import { domToRuns, type OverlayRunBase } from './domRuns';
import type { OverlayHistory } from './overlayHistory';
import { readSelectionOffsets, restoreOverlayFocus, writeRunsPreservingSelection } from './overlaySelection';
import { styleAtCaret } from './publishedRange';
import { runStyleAt } from './runSplice';
import type { StyleToggle, TextEditSelection, UseTextEditOptions } from './textEditTypes';

/**
 * The patch that toggles `toggle` against the styling in `current`: if it is
 * already carried, clear it; otherwise set it — so a mixed range turns fully
 * on. `nodeStyle` is read as well as `current`: a node flag renders on every
 * run whether or not the runs carry it, so the runs alone would read Cmd+B
 * inside a `fontWeight: 700` node as "not bold" and *add* bold.
 */
export function patchForToggle(
  current: RangeStyle,
  toggle: StyleToggle,
  nodeStyle: TextStyle,
): RunStylePatch {
  if (toggle === 'super' || toggle === 'sub') {
    return { script: current.script === toggle ? undefined : toggle };
  }
  const on = toggle === 'bold'
    ? rangeWeight(current, nodeStyle).bold === true
    : current[toggle] === true || styleHasFlag(nodeStyle, toggle);
  return { [toggle]: !on };
}


/** What the styling commands read and write of the edit they style. */
export interface SelectionStylingHost {
  readonly overlayRef: { readonly current: HTMLDivElement | null };
  readonly editingIdRef: { readonly current: string | null };
  readonly optsRef: { readonly current: Pick<UseTextEditOptions, 'setStyle' | 'onChange'> };
  readonly historyRef: { readonly current: OverlayHistory | null };
  /** The editing node's style: the one the edit holds, else the node's own. */
  readonly styleOf: (id: string) => TextStyle | undefined;
  /** Hold `style` as the node's and dress the overlay in it, returning the resolved style. */
  readonly restyleNode: (overlay: HTMLDivElement, id: string, style: TextStyle | null) => OverlayRunBase;
  readonly baseRef: { readonly current: OverlayRunBase };
  readonly sendDraft: (overlay: HTMLElement) => void;
  readonly pendingRef: { readonly current: RunStylePatch };
  readonly armPending: (next: RunStylePatch, at: number) => void;
  readonly selectionRef: { readonly current: TextEditSelection | null };
  readonly publishRange: (overlay: HTMLElement, range: TextEditSelection) => void;
}

/** `applyStyleToSelection` and `toggleStyle` for the edit `host` describes. */
export function useSelectionStyling(host: SelectionStylingHost) {
  const {
    overlayRef, editingIdRef, optsRef, historyRef, styleOf, restyleNode, baseRef, sendDraft,
    pendingRef, armPending, selectionRef, publishRange,
  } = host;
  const applyStyle = useCallback(function applyStyle(patch: RunStylePatch) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    // An empty patch would still round-trip the runs through
    // `applyStyleToRange`, whose normalization applies to the whole array.
    if (Object.keys(patch).length === 0) return;
    // Fall back to the last range that WAS in the overlay: the caller may be
    // a control that took focus (and with it the DOM selection) to be clicked.
    const range = readSelectionOffsets(overlay) ?? selectionRef.current;
    if (!range) return;

    // Lowering a flag the node itself sets is not expressible additively, so
    // it takes the rewrite in `setFlagOverRange`: clear the node flag, raise
    // it outside the range. It reaches existing text even from a collapsed caret.
    const id = editingIdRef.current;
    const canWriteStyle = optsRef.current.setStyle !== undefined || optsRef.current.onChange !== undefined;
    const runs = domToRuns(overlay);
    if (patch.bold === false && !('fontWeight' in patch) && id !== null) {
      patch = { ...patch, ...unboldPatch(styleOf(id) ?? {}) };
    }
    const unsetFlag = id !== null && canWriteStyle
      ? (Object.keys(patch) as FlagKey[]).find((key) =>
          key !== 'bold'
          && patch[key] === false
          && styleHasFlag(styleOf(id) ?? {}, key))
      : undefined;
    if (unsetFlag !== undefined && id !== null) {
      const r = setFlagOverRange(runs, styleOf(id) ?? {}, range.start, range.end, unsetFlag, false);
      const resolved = restyleNode(overlay, id, r.style);
      writeRunsPreservingSelection(overlay, r.runs, range.start, range.end, resolved);
      publishRange(overlay, range);
      // The rewrite raised the flag on every existing run, so a caret sitting
      // at the end of one is now *inside* a flagged span and the next
      // character would be absorbed by it. Arming the `false` makes
      // `beforeinput` open a fresh span instead.
      if (range.start === range.end) {
        armPending({ ...pendingRef.current, [unsetFlag]: false }, range.start);
      }
      restoreOverlayFocus(overlay, range);
      // Whatever else the patch carried still applies on its own terms.
      const rest = { ...patch };
      delete rest[unsetFlag];
      if (Object.keys(rest).length > 0) applyStyle(rest);
      sendDraft(overlay);
      return;
    }

    // A collapsed caret has no run to restyle, so the styling is armed for
    // the next character instead of silently doing nothing.
    if (range.start === range.end) {
      armPending(armPatch(runStyleAt(runs, range.start), pendingRef.current, patch), range.start);
      restoreOverlayFocus(overlay, range);
      return;
    }

    const next = applyStyleToRange(runs, range.start, range.end, patch);
    writeRunsPreservingSelection(overlay, next, range.start, range.end, baseRef.current);
    restoreOverlayFocus(overlay, range);
    // Republish from the range we just styled, not from the DOM selection:
    // when the patch came from chrome the selection is in that control.
    publishRange(overlay, range);
    sendDraft(overlay);
  }, [publishRange, armPending, editingIdRef, optsRef, styleOf, restyleNode, sendDraft, pendingRef, selectionRef, baseRef, overlayRef]);

  /** `applyStyle`, as one step of the edit's undo. */
  const applyStyleToSelection = useCallback((patch: RunStylePatch) => {
    historyRef.current?.before('other');
    applyStyle(patch);
    historyRef.current?.after();
  }, [applyStyle, historyRef]);

  const toggleStyle = useCallback((toggle: StyleToggle) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const range = readSelectionOffsets(overlay) ?? selectionRef.current;
    if (!range) return;
    const runs = domToRuns(overlay);
    const id = editingIdRef.current;
    const nodeStyle = (id !== null ? styleOf(id) : undefined) ?? {};
    // At a collapsed caret the styling in play is what the caret sits in plus
    // whatever is already armed, so pressing Cmd+B twice disarms rather than
    // arming a second time.
    const current = range.start === range.end
      ? armedOver(styleAtCaret(runs, range.start), pendingRef.current)
      : styleAtRange(runs, range.start, range.end);
    applyStyleToSelection(patchForToggle(current, toggle, nodeStyle));
  }, [applyStyleToSelection, editingIdRef, styleOf, pendingRef, selectionRef, overlayRef]);

  return { applyStyleToSelection, toggleStyle };
}
