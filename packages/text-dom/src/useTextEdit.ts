/**
 * In-place text editing via a contenteditable overlay positioned over the
 * text node's screen-space pose. Enter / blur commit; Shift+Enter inserts a
 * newline. The text layer should hide the node it's currently editing
 * (`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import {
  effectiveRangeStyle, resolveTextStyle, type RangeStyle, type RunStylePatch, type TextStyle,
} from '@weasel-js/text';
import { armedOver, usePendingStyle } from './armedStyle';
import { openEditOverlay } from './editOverlay';
import { useEditingId } from './editSession';
import { useHeldNodeStyle } from './heldNodeStyle';
import { writeEdit, type EditDraft } from './overlayDraft';
import { createOverlayEdits } from './overlayEdits';
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

  const [editingId, setEditingId] = useEditingId(optsRef);
  // `applyStyleToSelection` needs the node being edited to reach its
  // `TextStyle`, and is called from event handlers rather than from render.
  const editingIdRef = useLatest(editingId);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const { nodeStyle, nodeStyleRef, baseRef, holdNodeStyle, styleOf, restyleNode } = useHeldNodeStyle(optsRef);
  const follow = useOverlayFollow();
  const initialCaretRef = useRef<number | 'all'>('all');
  const draftRef = useRef<EditDraft | null>(null);
  const { pendingStyle, pendingRef, pendingAtRef, armPending, dropPending } = usePendingStyle();
  const historyRef = useRef<OverlayHistory | null>(null);
  const { selection, rangeStyle, selectionRef, publishRange, syncSelection, clearSelection } =
    usePublishedRange(overlayRef, pendingAtRef, dropPending);


  const cancelEdit = useCallback(() => setEditingId(null), [setEditingId]);

  const commit = useCallback(() => {
    const id = editingId;
    const overlay = overlayRef.current;
    const draft = draftRef.current;
    if (id == null || !overlay || !draft) return void setEditingId(null);
    const edit = draft.finished(overlay, nodeStyleRef.current);
    if (edit) {
      holdNodeStyle(null);
      writeEdit(optsRef.current, id, edit);
    }
    setEditingId(null);
  }, [editingId, optsRef, holdNodeStyle, setEditingId, nodeStyleRef]);

  const startEdit = useCallback((id: string, opts?: StartEditOptions) => {
    initialCaretRef.current = opts?.caret ?? 'all';
    setEditingId(id);
  }, [setEditingId]);

  const isEditing = useCallback((id: string) => editingId === id, [editingId]);

  const sendDraft = useCallback((overlay: HTMLElement) => {
    const id = editingIdRef.current;
    const draft = draftRef.current?.changed(overlay, nodeStyleRef.current);
    if (id !== null && draft) optsRef.current.onInput?.(id, draft);
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
    baseRef.current = style;
    const runs = optsRef.current.getRuns?.(editingId);
    const node = { text: getText(editingId), runs, style };
    const frame = {
      pose: () => optsRef.current.getScreenPose(editingId),
      clip: () => optsRef.current.getClipRect?.() ?? null,
    };
    const holdFor = optsRef.current.fontHold ?? TEXT_EDIT_FONT_HOLD;
    const opened = openEditOverlay(container, node, frame, holdFor, initialCaretRef.current);
    const { overlay, boxes, draft, place } = opened;
    draftRef.current = draft;
    overlayRef.current = overlay;
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
      dropPending, publishRange, sendDraft,
    });
    historyRef.current = history;

    const stopListening = listenToOverlay(overlay, boxes.scroll, {
      optsRef, commit, cancel: cancelEdit, history, toggleStyle, typing, syncSelection,
    });

    const stopFollowing = follow(place);

    return () => {
      stopFollowing();
      stopListening();
      opened.remove();
      overlayRef.current = null;
      historyRef.current = null;
      holdNodeStyle(null);
      clearSelection();
    };
  }, [editingId, opts.container, optsRef, commit, cancelEdit, syncSelection, clearSelection,
      follow, toggleStyle, dropPending, publishRange, holdNodeStyle, sendDraft, restyleNode, pendingRef,
      selectionRef, baseRef, nodeStyleRef]);

  return {
    editingId, startEdit, cancelEdit, commitEdit: commit, isEditing, nodeStyle,
    selection, rangeStyle, pendingStyle, applyStyleToSelection, toggleStyle,
    effectiveStyle: shownStyle(opts, editingId, nodeStyle, rangeStyle, pendingStyle),
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

