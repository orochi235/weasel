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
import { applyStyleToRange, runsCarryStyling, styleAtRange } from './runs/rangeStyle';
import type { RangeStyle, RunStylePatch } from './runs/rangeStyle';

// TODO: widen to `underline` / `strikethrough`. `rangeStyle.ts` already lists
// both in its `STYLE_KEYS` / `FLAG_KEYS` sets, so the run algebra is ready —
// only this type and the `onKeyDown` / `togglePending` switches are narrower.
// Until then Cmd+U is never intercepted, so the browser's native
// `formatUnderline` runs and `domToRuns`' `<u>` flattening makes it *appear*
// to work while bypassing `toggleFlagInRange` entirely: no toggle-off, no
// mixed-range "turn the whole selection on" rule, no pending style for a
// collapsed caret. The flattening should stay regardless — it's what makes
// pasted decoration survive — but it is defense in depth, not the fix.
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

/**
 * The caret's character range within the text being edited. Half-open
 * `[start, end)` over the concatenated run text, normalized so `start <= end`
 * regardless of which way the user dragged. `start === end` is a collapsed
 * caret — a real position, not the absence of one, which is why the hook
 * reports `null` rather than a zero-width range when there is no caret.
 */
export interface TextEditSelection {
  start: number;
  end: number;
}

/**
 * Character offsets of the current DOM selection within `overlay`, or `null`
 * when there is no selection or it lies outside the overlay. The one
 * DOM→offset conversion in the hook; everything that needs offsets goes
 * through here.
 */
function readSelectionOffsets(overlay: HTMLElement): TextEditSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!overlay.contains(range.startContainer) || !overlay.contains(range.endContainer)) {
    return null;
  }
  // `Range` boundary points are already in document order, so this is the
  // normalization for a backwards drag — anchor/focus are not consulted.
  const start = domPositionToCharOffset(overlay, range.startContainer, range.startOffset);
  const end = domPositionToCharOffset(overlay, range.endContainer, range.endOffset);
  return start <= end ? { start, end } : { start: end, end: start };
}

/**
 * Replace the overlay's contents with `runs` and put the caret back on
 * `[start, end)`. Rewriting the DOM destroys the selection, and losing it
 * after every styling change would mean re-selecting the word to apply a
 * second style — so this is the only way styling writes back.
 *
 * The caret is **not** restored while focus sits in a text-entry control.
 * Browsers route editing commands by selection rather than by focus, so a
 * document selection put back inside the contenteditable while a bar's
 * number field has focus means the very Enter that committed that field also
 * runs its `insertParagraph` default over the restored range — replacing the
 * text that was just styled with a line break. (Observed in Chrome.)
 *
 * Focus on a *button* is the opposite case and must still restore: toggling
 * bold, then italic, then underline is one flow over one selection, and
 * clicking a toolbar button does take focus. Buttons turn keystrokes into
 * clicks, not into editing commands, so the range is safe there.
 *
 * The hook remembers the range as character offsets either way, so a skipped
 * restore costs the highlight, never the target.
 */
function writeRunsPreservingSelection(
  overlay: HTMLElement,
  runs: readonly StyledRun[],
  start: number,
  end: number,
): void {
  const active = document.activeElement;
  const inTextEntry =
    active !== overlay &&
    !overlay.contains(active) &&
    (active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable));
  runsToDom(runs, overlay);
  if (inTextEntry) return;
  const a = charOffsetToDomPosition(overlay, start);
  const b = charOffsetToDomPosition(overlay, end);
  const sel = window.getSelection();
  if (!a || !b || !sel) return;
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

function sameSelection(a: TextEditSelection | null, b: TextEditSelection | null): boolean {
  if (a === null || b === null) return a === b;
  return a.start === b.start && a.end === b.end;
}

/** Screen-space pose passed to `useTextEdit` so the overlay can be placed and sized in CSS pixels. */
export interface TextEditScreenPose {
  /** Top-left in CSS pixels relative to `container`. Always screen pixels,
   *  including when `zoom` is set — the scale is anchored at this point, not
   *  translated by it. */
  x: number;
  y: number;
  /** Pre-scale — CSS pixels, or world units when `zoom` is set. */
  width: number;
  height: number;
  /** Pre-scale font size: `style.fontSize * zoom` when `zoom` is omitted, the
   *  world-unit `style.fontSize` when it is set. */
  fontSize: number;
  /** Effective on-screen line height multiplier (defaults to style.lineHeight). */
  lineHeight?: number;
  /**
   * CSS scale applied to the overlay (`transform: scale(zoom)`, anchored at
   * its top-left). Every other size on this pose, and every typographic
   * metric the hook writes, is then **pre-scale** — pass world units and the
   * transform does the world→screen conversion.
   *
   * This is the only way run-level typography can be correct at a zoom other
   * than 1. `runsToDom` emits run `fontSize` / `letterSpacing` in world units
   * and `domToRuns` reads them straight back; threading a scale through the
   * writer and its inverse through the reader would go lossy on fractional
   * zooms. Scaling the whole overlay instead leaves that serializer pure and
   * scales node-level and run-level values by the same factor for free.
   *
   * Omit it (the default, `1`) and the pose is plain screen pixels — the hook
   * then infers the world→screen factor from `fontSize / style.fontSize` to
   * scale node-level `letterSpacing`, and run-level overrides are left
   * unscaled. Correct only at zoom 1.
   */
  zoom?: number;
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
   * `setRuns(id, runs)` — but only when runs are actually in play: the node
   * already had some, or the edit produced styling. A plain-text edit of a
   * plain-text node still calls `setText` alone, so a node that has never
   * been styled doesn't grow a single-run `runs` array just for being edited.
   */
  setRuns?: (id: string, runs: StyledRun[]) => void;
  /**
   * Is `el` part of the editor's own chrome — a character-options bar, a
   * color popover, anything whose whole purpose is to style the text being
   * edited? Focus moving into one does not end the edit.
   *
   * Without this, the controls the feature exists for are exactly what
   * destroys it: clicking a size field blurs the overlay, blur commits, and
   * the caret the control was about to act on is gone. Toggle buttons can
   * dodge it by `preventDefault()`-ing their own mousedown, but a field the
   * user has to type into cannot.
   *
   * Chrome focus does not disturb the reported `selection` either — see
   * `UseTextEditReturn.selection`.
   */
  isEditorChrome?: (el: Element) => boolean;
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
   /**
   * The caret's character range, or `null` when nothing is being edited. A
   * collapsed caret reports `{ start: n, end: n }`, so `null` and "caret at
   * n" stay distinguishable — a character-styling control routes the
   * collapsed case to the node's `TextStyle` instead of to a range.
   *
   * Follows the DOM selection, which browsers (and jsdom) report from a task
   * rather than synchronously; anything this hook writes itself updates it
   * synchronously. A DOM selection that leaves the overlay does **not** clear
   * it: that is what happens when the user clicks a styling control, and
   * reporting `null` there would read as "collapsed caret" and send the
   * control's patch to the node instead of to the range. It is cleared on
   * `startEdit` and when the edit ends.
   */
  selection: TextEditSelection | null;
  /**
   * The styling shared by every run in `selection` — a concrete value where
   * the range agrees, `MIXED` where it doesn't. `null` exactly when
   * `selection` is `null`. A collapsed caret reports `{}`: no run is in
   * range, so the range reader has nothing to say and the node's style is
   * what applies.
   */
  rangeStyle: RangeStyle | null;
  /**
   * Write `patch` over `selection`. A no-op with no active edit, with a
   * collapsed caret (there is no range to style — patch the node's
   * `TextStyle` instead), or with an empty patch. The caret survives, so a
   * second style can be applied without re-selecting, and `rangeStyle`
   * reflects the write before this returns.
   */
  applyStyleToSelection: (patch: RunStylePatch) => void;
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
  const [selection, setSelection] = useState<TextEditSelection | null>(null);
  const [rangeStyle, setRangeStyle] = useState<RangeStyle | null>(null);

  /**
   * The published range, mirrored in a ref. `applyStyleToSelection` reads it
   * synchronously, and it is the fallback when the DOM selection has moved
   * into editing chrome. Cleared with the state, never separately.
   */
  const selectionRef = useRef<TextEditSelection | null>(null);

  /**
   * Recompute the published caret range and its styling from the overlay.
   * Called from the `selectionchange` listener and directly after anything
   * the hook writes, so a control reading `rangeStyle` right after a patch
   * sees the new value rather than flickering back to the old one.
   *
   * A selection that is not inside the overlay leaves the published range
   * alone rather than clearing it. That state means focus moved into a
   * control — which is precisely when the range matters most, and reporting
   * `null` would read to a consumer as "collapsed caret" and send its patch
   * to the wrong target. The range is cleared where it is actually over: on
   * `startEdit` and on teardown.
   */
  /** Publish `range` and the styling the overlay currently carries across it. */
  const publishRange = useCallback((overlay: HTMLElement, range: TextEditSelection) => {
    selectionRef.current = range;
    setSelection((prev) => (sameSelection(prev, range) ? prev : range));
    setRangeStyle(styleAtRange(domToRuns(overlay), range.start, range.end));
  }, []);

  const syncSelection = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const next = readSelectionOffsets(overlay);
    if (next === null) return;
    publishRange(overlay, next);
  }, [publishRange]);

  /** Drop the published range — the edit session it described is over. */
  const clearSelection = useCallback(() => {
    selectionRef.current = null;
    setSelection(null);
    setRangeStyle(null);
  }, []);

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
    // What decides this is whether *runs* are in play at the end of the
    // edit — not whether the overlay was seeded from them. Mirroring the
    // init-time guard (`getRuns` returned something non-empty) was the old
    // rule, and it silently dropped every styling a freshly created text
    // node acquired: no prior runs, so commit took the plain-text branch and
    // `domToRuns`' output went in the bin. So two ways in:
    //
    // - the node already had runs — they have to be rewritten even when the
    //   edit ended up unstyled, or stale styling survives a Cmd-B that
    //   turned it off; or
    // - the edit produced styling, whatever the node started as.
    //
    // A plain-text edit of a plain-text node satisfies neither and keeps the
    // cheap path, so a node that has no `runs` doesn't grow a single-run
    // array just for being edited.
    const priorRuns = optsRef.current.getRuns?.(id);
    const setRuns = optsRef.current.setRuns;
    const runs = setRuns ? domToRuns(overlay) : [];
    const hadRuns = priorRuns != null && priorRuns.length > 0;
    if (setRuns && (hadRuns || runsCarryStyling(runs))) {
      optsRef.current.setText(id, runsToPlainText(runs));
      setRuns(id, runs);
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

  const applyStyleToSelection = useCallback((patch: RunStylePatch) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    // An empty patch would still round-trip the runs through
    // `applyStyleToRange`, whose normalization applies to the whole array and
    // not just the patched span. Nothing asked for that, so don't do it.
    if (Object.keys(patch).length === 0) return;
    // Fall back to the last range that WAS in the overlay: the caller may be
    // a control that took focus (and with it the DOM selection) to be
    // clicked. `writeRunsPreservingSelection` puts the range back afterwards,
    // so a second styling can follow without re-selecting either way.
    const range = readSelectionOffsets(overlay) ?? selectionRef.current;
    if (!range || range.start === range.end) return;
    const next = applyStyleToRange(domToRuns(overlay), range.start, range.end, patch);
    writeRunsPreservingSelection(overlay, next, range.start, range.end);
    // Republish from the range we just styled, not from the DOM selection:
    // when the patch came from chrome the selection is in that control, and
    // re-reading it would leave a consumer showing the pre-patch styling.
    publishRange(overlay, range);
  }, [publishRange]);

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
    // Focus first, then place the caret: focusing an editable host is itself
    // a selection-moving act (jsdom collapses to the start; browsers vary),
    // so a range set beforehand is not reliably the one the user ends up with.
    overlay.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // The caret exists now, so publish it rather than waiting for the
    // `selectionchange` task — a control mounted alongside the editor would
    // otherwise render one frame with no selection.
    syncSelection();

    function handleStyleToggle(flag: StyleFlag): void {
      const range = readSelectionOffsets(overlay);
      if (!range) return;
      if (range.start === range.end) {
        togglePending(flag);
        return;
      }
      const next = toggleFlagInRange(domToRuns(overlay), range.start, range.end, flag);
      writeRunsPreservingSelection(overlay, next, range.start, range.end);
      syncSelection();
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
    const onBlur = (e: FocusEvent) => {
      const next = e.relatedTarget;
      const isChrome = optsRef.current.isEditorChrome;
      if (isChrome && next instanceof Element && isChrome(next)) return;
      commit();
    };

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

    // Blur can't be the only way out. Once focus has moved into editing
    // chrome the overlay is no longer focused, so nothing blurs when the user
    // clicks away and the edit would never end. A pointerdown that lands
    // outside both the overlay and the chrome is that click. Capture phase so
    // it runs ahead of whatever the click was aimed at (a canvas gesture, a
    // different tool) rather than after it.
    const onPointerDownOutside = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node) || overlay.contains(target)) return;
      const isChrome = optsRef.current.isEditorChrome;
      if (isChrome && target instanceof Element && isChrome(target)) return;
      commit();
    };

    overlay.addEventListener('keydown', onKeyDown);
    overlay.addEventListener('blur', onBlur);
    overlay.addEventListener('beforeinput', onBeforeInput);
    document.addEventListener('pointerdown', onPointerDownOutside, true);
    // `selectionchange` only exists on the document — there is no per-element
    // event for it — so this listens globally and `readSelectionOffsets`
    // filters to selections inside the overlay.
    document.addEventListener('selectionchange', syncSelection);

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
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('selectionchange', syncSelection);
      overlay.remove();
      styleEl?.remove();
      overlayRef.current = null;
      clearSelection();
    };
  }, [editingId, commit, cancelEdit, syncSelection, clearSelection]);

  return {
    editingId, startEdit, cancelEdit, commit, isEditing,
    selection, rangeStyle, applyStyleToSelection,
  };
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
  // A declared `zoom` means every size on the pose is pre-scale and the
  // overlay carries the view scale as a transform. Anchored at the top-left so
  // `left`/`top` stay screen pixels — including the +1/-1 nudge above, which
  // is a screen-pixel rasterization correction and must not scale with the
  // view. Written unconditionally (`none` at zoom 1) because the overlay
  // element outlives an edit session and would otherwise keep a stale scale.
  el.style.transformOrigin = '0 0';
  el.style.transform = pose.zoom !== undefined && pose.zoom !== 1 ? `scale(${pose.zoom})` : 'none';
  // `letter-spacing` is not part of the CSS `font` shorthand, so
  // `applyOverlayStyle`'s `el.style.font` never carries it — it needs its own
  // assignment. It also lives here rather than there because without a
  // transform it is the one world-unit typography value that has to be
  // re-scaled as the view zooms.
  //
  // Under a transform there is nothing to re-scale: the world value is the
  // value, and run-level overrides — which `runsToDom` writes in world units
  // — scale by the same factor. Without one, `pose.fontSize` is documented as
  // `style.fontSize * zoom`, so their ratio is the world→screen factor; run
  // overrides then stay unscaled, which is why that path is only correct at
  // zoom 1. (CSS inheritance makes a run span's own declaration *replace* this
  // value rather than add to it, in both paths.)
  const scale =
    pose.zoom !== undefined ? 1 : style.fontSize > 0 ? pose.fontSize / style.fontSize : 1;
  el.style.letterSpacing = `${style.letterSpacing * scale}px`;
}
