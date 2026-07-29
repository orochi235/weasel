/**
 * In-place text editing via a contenteditable overlay positioned over the
 * text node's screen-space pose. Enter / blur commit; Shift+Enter inserts a
 * newline; Escape cancels. The hook owns the DOM lifecycle of the overlay
 * element — caller just provides a container, the lookup hooks, and a
 * `setText` callback (which is responsible for op-batching/undo).
 *
 * The text layer should hide the node it's currently editing
 * (`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolvedTextStyle, TextStyle } from './textStyle';
import { fontString, resolveTextStyle } from './textStyle';
import type { StyledRun } from './runs';
import { runsToPlainText } from './runs';
import { runsToDom, domToRuns, charOffsetToDomPosition, domPositionToCharOffset } from './domRuns';
import { applyStyleToRange, styleAtRange } from './runs/rangeStyle';

type StyleFlag = 'bold' | 'italic';

/**
 * Toggle `flag` across `[start, end)`: if every run in range already has it,
 * clear it; otherwise set it — so a mixed range turns fully on, as in every
 * other text editor. The splitting and coalescing live in the run algebra.
 */
function toggleFlagInRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  flag: StyleFlag,
): StyledRun[] {
  const current = styleAtRange(runs, start, end)[flag];
  return applyStyleToRange(runs, start, end, { [flag]: current !== true });
}

/** Screen-space pose passed to `useTextEdit` so the overlay can be placed and sized in CSS pixels. */
export interface TextEditScreenPose {
  /** Top-left in CSS pixels relative to `container`. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Effective on-screen font size (style.fontSize * zoom). */
  fontSize: number;
  /** Effective on-screen line height multiplier (defaults to style.lineHeight). */
  lineHeight?: number;
}

/** Options for `useTextEdit`. */
export interface UseTextEditOptions {
  /** Element the overlay is appended to. Must be `position: relative`/absolute. */
  container: HTMLElement | null;
  /** Read the current text for `id`. */
  getText: (id: string) => string;
  /** Read style for `id` (used for font setup on the overlay). */
  getStyle: (id: string) => TextStyle | undefined;
  /** Read screen-space pose for `id`. Called per frame while editing. */
  getScreenPose: (id: string) => TextEditScreenPose | null;
  /** Commit text. Caller wraps in op/undo. */
  setText: (id: string, text: string) => void;
  /**
   * Optional: read the current rich-text runs for `id`. When provided AND
   * returns a non-empty array, the overlay renders the runs as styled
   * `<span data-run>` elements; otherwise the overlay is seeded with plain
   * text via `getText`.
   */
  getRuns?: (id: string) => readonly StyledRun[] | undefined;
  /**
   * Optional: commit rich-text runs back to the node. When omitted, only
   * `setText` is called with the plain-text form on commit. When provided,
   * commit calls both `setText` (with `runsToPlainText(runs)`) and
   * `setRuns(id, runs)`.
   */
  setRuns?: (id: string, runs: StyledRun[]) => void;
}

/** Options for `useTextEdit().startEdit`. */
export interface StartEditOptions {
  /**
   * Where to place the caret on edit start. Number = caret offset (0..text.length);
   * `'all'` selects the whole text (default — preserves the prior behavior).
   */
  caret?: number | 'all';
}

/** Return shape of `useTextEdit`. */
export interface UseTextEditReturn {
  editingId: string | null;
  startEdit: (id: string, opts?: StartEditOptions) => void;
  cancelEdit: () => void;
  commit: () => void;
  isEditing: (id: string) => boolean;
}

/** In-place text editing via a contenteditable overlay positioned over the text node's screen-space pose. */
export function useTextEdit(
  opts: UseTextEditOptions,
): UseTextEditReturn {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [editingId, setEditingId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const initialCaretRef = useRef<number | 'all'>('all');

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const commit = useCallback(() => {
    const id = editingId;
    const overlay = overlayRef.current;
    if (id == null || !overlay) {
      setEditingId(null);
      return;
    }
    // Match the init-time guard: only treat the overlay as rich-text when
    // getRuns returned a non-empty array (an empty array fell through to
    // plain-text init, so commit should too).
    const currentRuns = optsRef.current.getRuns?.(id);
    const usedRuns = currentRuns != null && currentRuns.length > 0;
    if (usedRuns && optsRef.current.setRuns) {
      const runs = domToRuns(overlay);
      optsRef.current.setText(id, runsToPlainText(runs));
      optsRef.current.setRuns(id, runs);
    } else {
      const text = overlay.innerText.replace(/\n$/, '');
      optsRef.current.setText(id, text);
    }
    setEditingId(null);
  }, [editingId]);

  const startEdit = useCallback((id: string, opts?: StartEditOptions) => {
    initialCaretRef.current = opts?.caret ?? 'all';
    setEditingId(id);
  }, []);

  const isEditing = useCallback((id: string) => editingId === id, [editingId]);

  useEffect(() => {
    if (editingId == null) return;
    const { container, getText, getStyle, getScreenPose } = optsRef.current;
    if (!container) return;

    const style = resolveTextStyle(getStyle(editingId));
    const overlay = document.createElement('div');
    const overlayClass = `weasel-text-edit-${++OVERLAY_SEQ}`;
    overlay.classList.add(overlayClass);
    overlay.setAttribute('contenteditable', 'true');
    overlay.spellcheck = false;
    const initialRuns = optsRef.current.getRuns?.(editingId);
    if (initialRuns && initialRuns.length > 0) {
      runsToDom(initialRuns, overlay);
    } else {
      overlay.innerText = getText(editingId);
    }
    applyOverlayStyle(overlay, style);
    const styleEl = installSelectionStyle(overlayClass, style);
    container.appendChild(overlay);
    overlayRef.current = overlay;

    placeOverlay(overlay, getScreenPose(editingId), style);

    const range = document.createRange();
    const initial = initialCaretRef.current;
    if (initial === 'all') {
      range.selectNodeContents(overlay);
    } else {
      placeCaretAt(overlay, range, initial);
    }
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    overlay.focus();

    function handleStyleToggle(flag: StyleFlag): void {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        togglePending(flag);
        return;
      }
      const startChar = domPositionToCharOffset(overlay, range.startContainer, range.startOffset);
      const endChar = domPositionToCharOffset(overlay, range.endContainer, range.endOffset);
      const current = domToRuns(overlay);
      const next = toggleFlagInRange(current, startChar, endChar, flag);
      runsToDom(next, overlay);
      const a = charOffsetToDomPosition(overlay, startChar);
      const b = charOffsetToDomPosition(overlay, endChar);
      if (a && b) {
        const newRange = document.createRange();
        newRange.setStart(a.node, a.offset);
        newRange.setEnd(b.node, b.offset);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }

    function togglePending(flag: StyleFlag): void {
      const key = flag === 'bold' ? 'pendingBold' : 'pendingItalic';
      if (overlay.dataset[key] === '1') {
        delete overlay.dataset[key];
      } else {
        overlay.dataset[key] = '1';
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i' || e.key === 'B' || e.key === 'I')) {
        e.preventDefault();
        const flag: StyleFlag = e.key.toLowerCase() === 'b' ? 'bold' : 'italic';
        handleStyleToggle(flag);
      }
    };
    const onBlur = () => commit();

    const onBeforeInput = (ie: InputEvent) => {
      if (ie.inputType !== 'insertText' || !ie.data) return;
      const pendingBold = overlay.dataset.pendingBold === '1';
      const pendingItalic = overlay.dataset.pendingItalic === '1';
      ie.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      if (pendingBold || pendingItalic) {
        // Insert a new styled span for the pending-style character.
        const span = document.createElement('span');
        span.setAttribute('data-run', '');
        if (pendingBold) span.style.fontWeight = '700';
        if (pendingItalic) span.style.fontStyle = 'italic';
        span.textContent = ie.data;
        range.insertNode(span);
        const after = document.createRange();
        after.setStartAfter(span);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        delete overlay.dataset.pendingBold;
        delete overlay.dataset.pendingItalic;
      } else {
        // No pending style — insert the character as a plain text node at the
        // caret position so the surrounding run's span absorbs it.
        const textNode = document.createTextNode(ie.data);
        range.insertNode(textNode);
        const after = document.createRange();
        after.setStartAfter(textNode);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      }
    };

    overlay.addEventListener('keydown', onKeyDown);
    overlay.addEventListener('blur', onBlur);
    overlay.addEventListener('beforeinput', onBeforeInput);

    const tick = () => {
      const pose = optsRef.current.getScreenPose(editingId);
      placeOverlay(overlay, pose, style);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      overlay.removeEventListener('keydown', onKeyDown);
      overlay.removeEventListener('blur', onBlur);
      overlay.removeEventListener('beforeinput', onBeforeInput);
      overlay.remove();
      styleEl?.remove();
      overlayRef.current = null;
    };
  }, [editingId, commit, cancelEdit]);

  return { editingId, startEdit, cancelEdit, commit, isEditing };
}

let OVERLAY_SEQ = 0;

/**
 * Place a collapsed caret `offset` characters into the overlay's text. Walks
 * the overlay's child nodes (the overlay's `innerText` was set from the
 * source string, so the DOM should be a single text node — but be defensive
 * in case the browser normalized whitespace into a slightly different shape).
 * Out-of-range offsets clamp to the end.
 */
function placeCaretAt(root: HTMLElement, range: Range, offset: number): void {
  let remaining = offset;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null = walker.nextNode() as Text | null;
  while (node) {
    const len = node.data.length;
    if (remaining <= len) {
      range.setStart(node, remaining);
      range.setEnd(node, remaining);
      return;
    }
    remaining -= len;
    node = walker.nextNode() as Text | null;
  }
  // Fallback: collapse at end of the root.
  range.selectNodeContents(root);
  range.collapse(false);
}

function applyOverlayStyle(el: HTMLDivElement, style: ResolvedTextStyle): void {
  el.style.position = 'absolute';
  el.style.boxSizing = 'border-box';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  el.style.outline = 'none';
  el.style.background = 'transparent';
  el.style.color = 'color' in style.fill ? style.fill.color : '#000';
  el.style.caretColor = style.caretColor;
  el.style.font = fontString(style);
  el.style.lineHeight = String(style.lineHeight);
  el.style.textAlign = style.align;
  // Node-level decoration, so the overlay looks like the canvas the moment
  // editing starts. Runs are additive over the node style (a run can't un-set
  // a flag), which is exactly how CSS decoration propagates to descendants —
  // a run span adds its own decoration but can't remove this one.
  const decorations: string[] = [];
  if (style.underline) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  el.style.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
  el.style.whiteSpace = 'pre-wrap';
  el.style.overflowWrap = 'break-word';
  el.style.wordBreak = 'normal';
}

/**
 * Inject a `<style>` element scoped to `overlayClass` so the edit overlay's
 * `::selection` matches the configured colors. Returns the style element so
 * the effect cleanup can remove it. Returns `null` when no selection
 * theming was requested.
 */
function installSelectionStyle(
  overlayClass: string,
  style: ResolvedTextStyle,
): HTMLStyleElement | null {
  if (style.selectionBackground == null && style.selectionColor == null) return null;
  const el = document.createElement('style');
  const decls: string[] = [];
  if (style.selectionBackground != null) {
    decls.push(`background: ${style.selectionBackground};`);
  }
  if (style.selectionColor != null) {
    decls.push(`color: ${style.selectionColor};`);
  }
  el.textContent = `.${overlayClass}::selection { ${decls.join(' ')} }`;
  document.head.appendChild(el);
  return el;
}

function placeOverlay(
  el: HTMLDivElement,
  pose: TextEditScreenPose | null,
  style: ResolvedTextStyle,
): void {
  if (!pose) {
    el.style.display = 'none';
    return;
  }
  // CSS lays out a contenteditable's first glyph one CSS pixel below and one
  // CSS pixel right of where canvas's `textBaseline = 'top'` rasterizes the
  // same glyph (empirically; varies by browser/font/DPR — the constant is a
  // pragmatic fix for the dev setup, not universally correct).
  el.style.display = '';
  el.style.left = `${pose.x + 1}px`;
  el.style.top = `${pose.y - 1}px`;
  el.style.width = `${pose.width}px`;
  el.style.minHeight = `${pose.height}px`;
  el.style.fontSize = `${pose.fontSize}px`;
  el.style.lineHeight = String(pose.lineHeight ?? style.lineHeight);
  // `letter-spacing` is not part of the CSS `font` shorthand, so
  // `applyOverlayStyle`'s `el.style.font` never carries it — it needs its own
  // assignment. It also lives here rather than there because it's the one
  // world-unit typography value that has to be re-scaled as the view zooms.
  //
  // `pose.fontSize` is documented as `style.fontSize * zoom`, so their ratio
  // is the overlay's world→screen factor — the same one that already turns
  // the style's font size into the on-screen one. Run-level overrides come
  // through `runsToDom`'s spans; CSS inheritance makes a span's own
  // declaration replace this value rather than add to it.
  const scale = style.fontSize > 0 ? pose.fontSize / style.fontSize : 1;
  el.style.letterSpacing = `${style.letterSpacing * scale}px`;
}
