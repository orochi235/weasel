/**
 * In-place text editing via a contenteditable overlay positioned over the
 * text node's screen-space pose. Enter / blur commit; Shift+Enter inserts a
 * newline. The text layer should hide the node it's currently editing
 * (`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import type { TextStyle } from '@weasel-js/text';
import { resolveTextStyle } from '@weasel-js/text';
import { editEnd, imeKey, timerScheduler } from '@weasel-js/ui-input';
import { historyKey } from '@weasel-js/gestures';
import type { StyledRun } from '@weasel-js/text';
import { domToRuns } from './domRuns';
import { holdForFaces, installSelectionStyle, openingRange } from './overlayOpen';
import { effectiveRangeStyle, type RangeStyle, type RunStylePatch } from '@weasel-js/text';
import { armedOver, usePendingStyle } from './armedStyle';
import { overlayHistory, type OverlayHistory, type OverlayState } from './overlayHistory';
import { draftChanged, overlayDraft, writeEdit } from './overlayDraft';
import { usePublishedRange } from './publishedRange';
import { overlayTop } from './overlayFrame';
import { mountOverlayBoxes, placeOverlay } from './overlayPlace';
export { overlayTop };
import { applyOverlayStyle } from './overlayStyle';
import { useHeldNodeStyle } from './heldNodeStyle';
import { seedOverlay, type CaretHolder } from './overlaySeed';
import {
  readSelectionOffsets, writeRunsPreservingSelection,
} from './overlaySelection';
import { typingHandlers } from './overlayTyping';
import { toggleForKey } from './styleShortcuts';
import { useEditingId } from './editSession';
import { useSelectionStyling } from './selectionStyling';
import { TEXT_EDIT_FONT_HOLD } from './textEditTypes';
import type {
  StartEditOptions, TextEditSelection, UseTextEditOptions,
  UseTextEditReturn,
} from './textEditTypes';

/** In-place text editing via a contenteditable overlay positioned over the text node's screen-space pose. */
export function useTextEdit(
  opts: UseTextEditOptions,
): UseTextEditReturn {
  const optsRef = useLatest(opts);

  const [editingId, setEditingId] = useEditingId(optsRef);
  // `applyStyleToSelection` needs the node being edited to reach its
  // `TextStyle`, and is called from event handlers rather than from render.
  const editingIdRef = useLatest(editingId);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { nodeStyle, nodeStyleRef, baseRef, holdNodeStyle, styleOf, restyleNode } = useHeldNodeStyle(optsRef);
  // The overlay-follow loop is built inside the editing effect; the gate's
  // frame callback reaches it through this ref.
  const tickRef = useRef<() => void>(() => {});
  const frameLoop = useVisibleRaf(() => { tickRef.current(); });
  const initialCaretRef = useRef<number | 'all'>('all');
  /** What the overlay read back as when the edit opened, before any input. */
  const openedRef = useRef<string | null>(null);
  const sentRef = useRef(''); // the last draft sent, as JSON; before the first, the overlay as it opened
  const holderRef = useRef<CaretHolder | null>(null);
  const priorRunsRef = useRef<readonly StyledRun[] | undefined>(undefined); // the node's, as the edit opened
  const { pendingStyle, pendingRef, pendingAtRef, armPending, dropPending } = usePendingStyle();
  const historyRef = useRef<OverlayHistory | null>(null);
  const { selection, rangeStyle, selectionRef, publishRange, syncSelection, clearSelection } =
    usePublishedRange(overlayRef, pendingAtRef, dropPending);


  const cancelEdit = useCallback(() => setEditingId(null), [setEditingId]);

  const commit = useCallback(() => {
    const id = editingId;
    const overlay = overlayRef.current;
    if (id == null || !overlay) return void setEditingId(null);
    // Runs are written when the node already had them — or stale styling
    // survives a Cmd-B that turned it off — or when the edit produced
    // styling. A plain-text edit of a plain-text node commits text alone.
    const read = domToRuns(overlay);
    const style = nodeStyleRef.current;
    // Compared untrimmed: a seeded trailing newline reads back the same at
    // both ends, where the trimmed form would differ from the node's text.
    if (!style && JSON.stringify(read) === openedRef.current) {
      setEditingId(null);
      return;
    }
    holdNodeStyle(null);
    writeEdit(optsRef.current, id, overlayDraft(read, holderRef.current, priorRunsRef.current, style));
    setEditingId(null);
  }, [editingId, optsRef, holdNodeStyle, setEditingId, nodeStyleRef]);

  const startEdit = useCallback((id: string, opts?: StartEditOptions) => {
    initialCaretRef.current = opts?.caret ?? 'all';
    setEditingId(id);
  }, [setEditingId]);

  const isEditing = useCallback((id: string) => editingId === id, [editingId]);

  const sendDraft = useCallback((overlay: HTMLElement) => {
    const id = editingIdRef.current;
    const draft = overlayDraft(domToRuns(overlay), holderRef.current, priorRunsRef.current, nodeStyleRef.current);
    if (id !== null && draftChanged(sentRef, draft)) optsRef.current.onInput?.(id, draft);
  }, [editingIdRef, optsRef, nodeStyleRef]);

  const { applyStyleToSelection, toggleStyle } = useSelectionStyling({
    overlayRef, editingIdRef, optsRef, historyRef, styleOf, restyleNode, baseRef, sendDraft,
    pendingRef, armPending, selectionRef, publishRange,
  });

  useEffect(() => {
    if (editingId == null) return;
    const { container, getText, getStyle, getPaint } = optsRef.current;
    if (!container) return;
    holdNodeStyle(null);

    const style = resolveTextStyle(getStyle(editingId), getPaint?.(editingId));
    const overlay = document.createElement('div');
    const overlayClass = `weasel-text-edit-${++OVERLAY_SEQ}`;
    overlay.classList.add(overlayClass);
    overlay.setAttribute('contenteditable', 'true');
    overlay.spellcheck = false;
    baseRef.current = style;
    const initialRuns = (priorRunsRef.current = optsRef.current.getRuns?.(editingId));
    holderRef.current = seedOverlay(overlay, getText(editingId), initialRuns, style);
    openedRef.current = JSON.stringify(domToRuns(overlay));
    sentRef.current = JSON.stringify(overlayDraft(domToRuns(overlay), holderRef.current, initialRuns));
    applyOverlayStyle(overlay, style);
    const holdFor = optsRef.current.fontHold ?? TEXT_EDIT_FONT_HOLD;
    const hold = holdFor > 0 ? holdForFaces(style, initialRuns ?? []) : null;
    if (hold) overlay.style.opacity = '0';
    const styleEl = installSelectionStyle(overlayClass, style);
    const boxes = mountOverlayBoxes(container, overlay);
    overlayRef.current = overlay;

    const place = () => {
      const clip = optsRef.current.getClipRect?.() ?? null;
      placeOverlay(overlay, boxes, optsRef.current.getScreenPose(editingId), clip, style);
    };
    place();
    // Measured again on release: the first `place` ran in the fallback face.
    let held = hold !== null;
    const release = () => {
      if (!held) return;
      held = false;
      cancelHold();
      place();
      overlay.style.opacity = '';
    };
    const cancelHold = held ? timerScheduler.set(release, holdFor) : () => {};
    void hold?.then(release);

    const range = openingRange(overlay, initialCaretRef.current);
    // Focus first, then place the caret: focusing an editable host itself
    // moves the selection (jsdom collapses to the start; browsers vary).
    boxes.scroller.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Publish now rather than on the `selectionchange` task — a control mounted
    // alongside the editor would otherwise render one frame with no selection.
    syncSelection();

    const onKeyDown = (e: KeyboardEvent) => {
      if (imeKey(e)) return;
      const ends = editEnd({ key: e.key, shift: e.shiftKey }, { escape: optsRef.current.escape, multiline: true });
      if (ends) {
        e.preventDefault();
        if (ends === 'commit') commit();
        else cancelEdit();
        return;
      }
      const step = historyKey(e);
      if (step) {
        e.preventDefault();
        history[step]();
        return;
      }
      const toggle = toggleForKey(e);
      if (toggle) {
        e.preventDefault();
        toggleStyle(toggle);
      }
    };
    const onBlur = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (isChrome(optsRef.current, next)) return;
      commit();
    };

    const written = (range: TextEditSelection) => {
      holderRef.current?.wrote(overlay, range.end);
      dropPending();
      publishRange(overlay, range);
    };
    const edited = () => {
      holderRef.current?.edited(overlay);
      place();
      boxes.scroller.reveal();
      sendDraft(overlay);
      history.after();
    };
    const history = (historyRef.current = overlayHistory({
      read: (): OverlayState | null => {
        const at = readSelectionOffsets(overlay) ?? selectionRef.current;
        const runs = domToRuns(overlay);
        return at && { runs: holderRef.current?.trim(runs) ?? runs, selection: at, style: nodeStyleRef.current };
      },
      write: ({ runs, selection: at, style: held }) => {
        const base = restyleNode(overlay, editingId, held);
        writeRunsPreservingSelection(overlay, runs, at.start, at.end, base);
        holderRef.current?.reseed(runs);
        written(at);
        edited();
      },
    }));
    const { onBeforeInput, onInput, onCompositionStart, onCompositionEnd } = typingHandlers(overlay, {
      pending: () => pendingRef.current,
      base: () => baseRef.current,
      lastRange: () => selectionRef.current,
      onWritten: written,
      onEdited: edited,
      history,
    });

    // Blur can't be the only way out: once focus has moved into editing
    // chrome, nothing blurs when the user clicks away. Capture phase so this
    // runs ahead of whatever the click was aimed at.
    const onPointerDownOutside = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node) || boxes.scroll.contains(target)) return;
      if (isChrome(optsRef.current, target)) return;
      commit();
    };

    // Typing can change the line count; re-placing on `input` rather than on the
    // next frame keeps a center/bottom-aligned overlay from jumping a frame late.
    const listeners = Object.entries({
      keydown: onKeyDown, blur: onBlur, input: onInput, beforeinput: onBeforeInput,
      compositionstart: onCompositionStart, compositionend: onCompositionEnd,
    }) as Array<[string, EventListener]>;
    for (const [type, fn] of listeners) overlay.addEventListener(type, fn);
    document.addEventListener('pointerdown', onPointerDownOutside, true);
    // `selectionchange` only exists on the document.
    document.addEventListener('selectionchange', syncSelection);

    // Follows the node's screen pose every frame — behind the visibility gate,
    // so an overlay left open in a background tab costs nothing.
    tickRef.current = () => {
      place();
      frameLoop.request();
    };
    frameLoop.request();

    return () => {
      held = false;
      cancelHold();
      frameLoop.cancel();
      tickRef.current = () => {};
      for (const [type, fn] of listeners) overlay.removeEventListener(type, fn);
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('selectionchange', syncSelection);
      boxes.remove();
      styleEl?.remove();
      overlayRef.current = null;
      historyRef.current = null;
      holdNodeStyle(null);
      clearSelection();
    };
  }, [editingId, opts.container, optsRef, commit, cancelEdit, syncSelection, clearSelection,
      frameLoop, toggleStyle, dropPending, publishRange, holdNodeStyle, sendDraft, restyleNode, pendingRef,
      selectionRef, baseRef, nodeStyleRef]);

  return {
    editingId, startEdit, cancelEdit, commitEdit: commit, isEditing, nodeStyle,
    selection, rangeStyle, pendingStyle, applyStyleToSelection, toggleStyle,
    effectiveStyle: shownStyle(opts, editingId, nodeStyle, rangeStyle, pendingStyle),
  };
}

function isChrome(opts: UseTextEditOptions, el: EventTarget | null): boolean {
  return el instanceof Element && (opts.isEditorChrome?.(el) ?? false);
}

function shownStyle(
  opts: UseTextEditOptions,
  editingId: string | null,
  nodeStyle: TextStyle | null,
  rangeStyle: RangeStyle | null,
  pendingStyle: RunStylePatch,
): RangeStyle | null {
  if (editingId === null) return null;
  return effectiveRangeStyle(
    armedOver(rangeStyle ?? {}, pendingStyle),
    nodeStyle ?? opts.getStyle(editingId),
    opts.getPaint?.(editingId),
  );
}

let OVERLAY_SEQ = 0;
