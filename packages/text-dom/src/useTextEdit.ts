/**
 * In-place text editing via a contenteditable overlay positioned over the
 * text node's screen-space pose. Enter / blur commit; Shift+Enter inserts a
 * newline. The text layer should hide the node it's currently editing
 * (`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import {
  effectiveRangeStyle, resolveTextStyle, type RangeStyle, type ResolvedTextStyle, type RunStylePatch, type TextStyle,
} from '@weasel-js/text';
import { armedOver, usePendingStyle } from './armedStyle';
import { openEditOverlay, type EditedFrame } from './editOverlay';
import { useEditingId } from './editSession';
import { useHeldNodeStyle } from './heldNodeStyle';
import { writeEdit, type EditDraft } from './overlayDraft';
import { createOverlayEdits } from './overlayEdits';
import { useEditCarry, type CarriedEdit } from './overlayCarry';
import { overlayTop } from './overlayFrame';
import { useOverlayFollow } from './overlayFollow';
import type { OverlayHistory } from './overlayHistory';
import { listenToOverlay } from './overlayListeners';
import { usePublishedRange } from './publishedRange';
import { useSelectionStyling } from './selectionStyling';
import { TEXT_EDIT_FONT_HOLD } from './textEditTypes';
import type { StartEditOptions, UseTextEditOptions, UseTextEditReturn } from './textEditTypes';

export { overlayTop };

/** In-place text editing via a contenteditable overlay positioned over the text node's screen-space pose. */
export function useTextEdit(
  opts: UseTextEditOptions,
): UseTextEditReturn {
  const optsRef = useLatest(opts);

  const [editingId, setEditingId, liveIdRef, session] = useEditingId(optsRef);
  // `applyStyleToSelection` needs the node being edited to reach its
  // `TextStyle`, and is called from event handlers rather than from render.
  const editingIdRef = useLatest(editingId);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { nodeStyle, nodeStyleRef, baseRef, holdNodeStyle, styleOf, restyleNode, placeRef } = useHeldNodeStyle(optsRef);
  const follow = useOverlayFollow();
  const initialCaretRef = useRef<number | 'all' | 'end'>('all');
  const draftRef = useRef<EditDraft | null>(null);
  const { pendingStyle, pendingRef, pendingAtRef, armPending, dropPending } = usePendingStyle();
  const historyRef = useRef<OverlayHistory | null>(null);
  const { selection, rangeStyle, selectionRef, publishRange, syncSelection, clearSelection } =
    usePublishedRange(overlayRef, pendingAtRef, dropPending);

  // Each way out drops the draft first: a blur `onEnd` causes reaches `commit` while the overlay is still mounted.
  const cancelEdit = useCallback(() => { draftRef.current = null; setEditingId(null); }, [setEditingId]);

  const { takeCarry, stashCarry, peekCarry } = useEditCarry({
    editingIdRef, optsRef, selectionRef, nodeStyleRef, pendingRef, pendingAtRef,
  });

  const commit = useCallback(() => {
    const id = editingId;
    const open = openEdit(overlayRef.current, draftRef.current, nodeStyleRef.current, peekCarry(id));
    draftRef.current = null;
    if (id == null || !open) return void setEditingId(null);
    const edit = open.draft.finished(open.overlay, open.held);
    if (edit) { holdNodeStyle(null); writeEdit(optsRef.current, id, edit); }
    setEditingId(null);
  }, [editingId, optsRef, holdNodeStyle, setEditingId, nodeStyleRef, peekCarry]);

  const startEdit = useCallback((id: string, opts?: StartEditOptions) => {
    initialCaretRef.current = opts?.caret ?? 'all';
    if (liveIdRef.current !== null && liveIdRef.current !== id) commit();
    if (liveIdRef.current !== id) draftRef.current = null;
    setEditingId(id);
  }, [setEditingId, liveIdRef, commit]);

  const isEditing = useCallback((id: string) => editingId === id, [editingId]);

  const sendDraft = useCallback((overlay: HTMLElement) => {
    const id = editingIdRef.current;
    const draft = draftRef.current?.changed(overlay, nodeStyleRef.current);
    if (id !== null && draft) optsRef.current.onInput?.(id, draft);
  }, [editingIdRef, optsRef, nodeStyleRef]);

  const { applyStyleToSelection, toggleStyle, focusRef } = useSelectionStyling({
    overlayRef, editingIdRef, optsRef, historyRef, styleOf, restyleNode, baseRef, sendDraft,
    pendingRef, armPending, selectionRef, publishRange,
  });

  useEffect(() => {
    const { container, getText, getStyle, getPaint } = optsRef.current;
    const carried = takeCarry(editingId, container != null);
    holdNodeStyle(editingId == null ? null : carried?.held ?? null);
    if (editingId == null || !container) return;

    const style = resolveTextStyle(carried?.held ?? getStyle(editingId), getPaint?.(editingId));
    baseRef.current = style;
    const node = { text: getText(editingId), runs: optsRef.current.getRuns?.(editingId), style, carried: carried ?? undefined };
    const frame = editedFrame(optsRef, editingId, baseRef);
    const holdFor = optsRef.current.fontHold ?? TEXT_EDIT_FONT_HOLD;
    const opened = openEditOverlay(container, node, frame, holdFor, carried?.selection ?? initialCaretRef.current);
    const { overlay, boxes, draft, place } = opened;
    draftRef.current = draft;
    overlayRef.current = overlay;
    focusRef.current = boxes.scroller.focus;
    placeRef.current = place;
    // Publish now rather than on the `selectionchange` task — a control mounted
    // alongside the editor would otherwise render one frame with no selection.
    syncSelection();

    const { history, typing } = createOverlayEdits(overlay, {
      holder: draft.holder,
      pending: () => pendingRef.current,
      base: () => baseRef.current,
      lastRange: () => selectionRef.current,
      nodeStyle: () => nodeStyleRef.current,
      restyle: (held) => restyleNode(overlay, editingId, held),
      follow: () => {
        place();
        boxes.scroller.reveal();
      },
      dropPending, publishRange, sendDraft, steps: carried?.steps,
    });
    historyRef.current = history;
    if (carried?.armed) armPending(carried.armed.patch, carried.armed.at);

    const stopListening = listenToOverlay(overlay, boxes.scroll, {
      optsRef, commit, cancel: cancelEdit, history, toggleStyle, typing, syncSelection,
    });

    const stopFollowing = follow(place);

    return () => {
      stashCarry(editingId, container, overlay, draft, history);
      stopFollowing();
      stopListening();
      placeRef.current = () => {};
      opened.remove();
      overlayRef.current = null;
      historyRef.current = null;
      holdNodeStyle(null);
      clearSelection();
    };
  }, [editingId, session, opts.container, optsRef, takeCarry, stashCarry, commit, cancelEdit, syncSelection, clearSelection,
      follow, toggleStyle, dropPending, armPending, publishRange, holdNodeStyle, sendDraft, restyleNode, pendingRef,
      selectionRef, baseRef, nodeStyleRef, placeRef, focusRef]);

  return {
    editingId, startEdit, cancelEdit, commitEdit: commit, isEditing, nodeStyle,
    selection, rangeStyle, pendingStyle, applyStyleToSelection, toggleStyle,
    effectiveStyle: shownStyle(opts, editingId, nodeStyle, rangeStyle, pendingStyle),
  };
}

/** The open edit's overlay, draft and held style; or, while it has no container, the carried one's, in an overlay
 *  detached from the page that commits as one would. */
function openEdit(
  overlay: HTMLElement | null, draft: EditDraft | null, held: TextStyle | null, carried: CarriedEdit | null,
): { overlay: HTMLElement; draft: EditDraft; held: TextStyle | null } | null {
  if (overlay && draft) return { overlay, draft, held };
  if (!carried) return null;
  const detached = document.createElement('div');
  detached.append(carried.content.cloneNode(true));
  return { overlay: detached, draft: carried.draft, held: carried.held };
}

/** Where the node `id` is on screen now, and the style the edit holds it in, read through the latest options. */
function editedFrame(
  optsRef: { readonly current: Pick<UseTextEditOptions, 'getScreenPose' | 'getClipRect'> },
  id: string,
  baseRef: { readonly current: ResolvedTextStyle },
): EditedFrame {
  return {
    pose: () => optsRef.current.getScreenPose(id),
    clip: () => optsRef.current.getClipRect?.() ?? null,
    style: () => baseRef.current,
  };
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

