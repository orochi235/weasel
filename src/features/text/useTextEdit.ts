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
}

export interface StartEditOptions {
  /**
   * Where to place the caret on edit start. Number = caret offset (0..text.length);
   * `'all'` selects the whole text (default — preserves the prior behavior).
   */
  caret?: number | 'all';
}

export interface UseTextEditReturn {
  editingId: string | null;
  startEdit: (id: string, opts?: StartEditOptions) => void;
  cancelEdit: () => void;
  commit: () => void;
  isEditing: (id: string) => boolean;
}

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
    const text = overlay.innerText.replace(/\n$/, '');
    optsRef.current.setText(id, text);
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
    overlay.innerText = getText(editingId);
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    };
    const onBlur = () => commit();

    overlay.addEventListener('keydown', onKeyDown);
    overlay.addEventListener('blur', onBlur);

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
}
