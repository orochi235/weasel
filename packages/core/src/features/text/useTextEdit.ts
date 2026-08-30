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
import { useVisibleRaf } from '../../scheduling/useVisibleRaf';
import type { ResolvedTextStyle, TextStyle } from '@weasel-js/text';
import { fontString, resolveTextStyle } from '@weasel-js/text';
import type { TextPaint } from '@weasel-js/text';
import type { StyledRun } from '@weasel-js/text';
import { runsToPlainText } from '@weasel-js/text';
import { runsToDom, domToRuns, charOffsetToDomPosition, domPositionToCharOffset } from './domRuns';
import { applyStyleToRange, runsCarryStyling, styleAtRange } from './runs/rangeStyle';
import { nodeHasFlag, setFlagOverRange, type FlagKey } from './runs/flagRange';
import type { RangeStyle, RunStylePatch } from './runs/rangeStyle';

type StyleFlag = FlagKey;

/**
 * A styling a shortcut or a control toggles. The additive booleans, plus the
 * two `script` values — which are exclusive rather than additive, so they
 * toggle against one enum rather than each owning a boolean.
 */
export type StyleToggle = StyleFlag | 'super' | 'sub';

/**
 * The shortcut each styling answers to. Strikethrough takes Cmd+Shift+X
 * (Docs' binding) and MUST require shift: bare Cmd+X is cut, and swallowing
 * it here would break cutting text mid-edit. Superscript takes Word's
 * Cmd+Shift+=; subscript takes Cmd+Shift+- rather than Word's Cmd+-, because
 * the unshifted pair is browser zoom, which a page cannot cancel.
 * `overline` has no shortcut — no editor has established one — and is
 * reachable only from a control.
 *
 * Matching is on the *unshifted* character (`shiftedKey`): a US layout
 * reports Cmd+Shift+= as `'+'` and Cmd+Shift+- as `'_'`, so keying the table
 * on what the legend says needs that mapping to survive the shift.
 *
 * Underline has to be intercepted, not merely supported. Left alone, the
 * browser runs its own `formatUnderline` and `domToRuns`' `<u>` flattening
 * makes that *look* like it worked while bypassing `patchForToggle`
 * entirely — no toggle-off, no mixed-range "turn the whole selection on"
 * rule, no pending style for a collapsed caret. The flattening stays
 * regardless, since it is what lets pasted decoration survive, but it is
 * defense in depth and was never the mechanism.
 */
const STYLE_SHORTCUTS: ReadonlyArray<{ key: string; shift: boolean; toggle: StyleToggle }> = [
  { key: 'b', shift: false, toggle: 'bold' },
  { key: 'i', shift: false, toggle: 'italic' },
  { key: 'u', shift: false, toggle: 'underline' },
  { key: 'x', shift: true, toggle: 'strikethrough' },
  { key: '=', shift: true, toggle: 'super' },
  { key: '-', shift: true, toggle: 'sub' },
];

/** The characters shift produces from the keys the table names. */
const UNSHIFT: Readonly<Record<string, string>> = { '+': '=', _: '-' };

/** The styling `e` toggles, or null when it isn't a styling shortcut. */
function toggleForKey(e: KeyboardEvent): StyleToggle | null {
  if (!e.metaKey && !e.ctrlKey) return null;
  const raw = e.key.toLowerCase();
  const key = UNSHIFT[raw] ?? raw;
  return STYLE_SHORTCUTS.find((s) => s.key === key && s.shift === e.shiftKey)?.toggle ?? null;
}

/**
 * The patch that toggles `toggle` against the styling in `current`: if it is
 * already carried, clear it; otherwise set it — so a mixed range turns fully
 * on, as in every other text editor. `script` clears to `undefined` rather
 * than to `false`, since the off state of an enum is its absence.
 *
 * `nodeStyle` is read as well as `current`, and has to be: a node flag
 * renders on every run whether or not the runs carry it, so a toggle that
 * consulted the runs alone would read Cmd+B inside a `fontWeight: 700` node
 * as "not bold" and *add* bold rather than clearing it. `script` has no node
 * level to consult — by design; see `StyledRun.script`.
 */
function patchForToggle(
  current: RangeStyle,
  toggle: StyleToggle,
  nodeStyle: TextStyle,
): RunStylePatch {
  if (toggle === 'super' || toggle === 'sub') {
    return { script: current.script === toggle ? undefined : toggle };
  }
  const on = current[toggle] === true || nodeHasFlag(nodeStyle, toggle);
  return { [toggle]: !on };
}

/**
 * The styling at a collapsed caret: the run to its left, or — at the very
 * start of the text — the run to its right. This is what the next typed
 * character inherits, so it is what a character bar should be showing.
 */
function styleAtCaret(runs: readonly StyledRun[], at: number): RangeStyle {
  return at > 0 ? styleAtRange(runs, at - 1, at) : styleAtRange(runs, 0, 1);
}

/**
 * Splice `run` into `runs` at character offset `at`, splitting whichever run
 * spans it. The result is normalized (empty runs dropped, identical
 * neighbours merged) by the same algebra every other write goes through.
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
 * Return focus to the overlay after a styling arrived from editor chrome.
 *
 * A control that took focus in order to be clicked still holds it when the
 * patch lands, so the next keystroke goes to that button — and in an app that
 * binds bare letters to tools, "click Superscript, then type the 2" activates
 * the Text tool and pans the canvas instead of typing a 2. Restoring the
 * caret is what makes a styling control usable mid-edit at all.
 *
 * Two things are left holding focus deliberately: a text entry in the chrome
 * (the user is still typing a font size — stealing that is worse than the
 * problem) and anything inside an open dialog, which is where a color
 * picker's live `onChange` fires from.
 */
function restoreOverlayFocus(overlay: HTMLElement, range: TextEditSelection): void {
  const active = document.activeElement;
  if (active === overlay || overlay.contains(active)) return;
  if (
    active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || (active instanceof HTMLElement && active.isContentEditable)
    || (active instanceof Element && active.closest('[role="dialog"]') !== null)
  ) return;
  overlay.focus();
  const a = charOffsetToDomPosition(overlay, range.start);
  const b = charOffsetToDomPosition(overlay, range.end);
  const sel = window.getSelection();
  if (!a || !b || !sel) return;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(r);
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
function placeCaretBetweenRuns(
  overlay: HTMLElement,
  runs: readonly StyledRun[],
  offset: number,
): void {
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

/** No pending style. One frozen object so re-publishing an already-empty
 *  pending style doesn't re-render every consumer. */
const NO_PENDING: RunStylePatch = Object.freeze({});

/**
 * Merge `patch` into a pending style. A key set to `false` or `undefined` is
 * deleted rather than stored — the same canonical form `patchRun` keeps, so
 * the pending style and a stored run agree on what "off" looks like.
 */
function mergePending(prev: RunStylePatch, patch: RunStylePatch): RunStylePatch {
  const next: Record<string, unknown> = { ...prev };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === false) delete next[key];
    else next[key] = value;
  }
  return next as RunStylePatch;
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

/**
 * Drop the one trailing newline a contenteditable keeps so the caret has
 * somewhere to sit on the last line. `innerText` reports it too, and the
 * plain-text commit path has always stripped it; `domToRuns` maps the `<br>`
 * to a literal `'\n'`, so without this the same edit commits a byte more
 * text through the rich path than through the plain one. Exactly one, so a
 * newline the user actually typed survives — the holder is never doubled.
 *
 * An empty run left behind is dropped: it carries no text and would otherwise
 * defeat `runsCarryStyling`'s "did this edit produce styling" question by
 * existing.
 */
function trimCaretHolder(runs: StyledRun[]): StyledRun[] {
  const last = runs[runs.length - 1];
  if (last === undefined || !last.text.endsWith('\n')) return runs;
  const trimmed = { ...last, text: last.text.slice(0, -1) };
  const head = runs.slice(0, -1);
  return trimmed.text === '' ? head : [...head, trimmed];
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
  /**
   * Read the node's paint for `id` — its `data.fill` / `data.stroke`. The
   * overlay paints its text and caret from the fill, so omitting this
   * renders every node's editor in the default black however the node
   * itself is painted.
   */
  getPaint?: (id: string) => TextPaint | undefined;
  /**
   * Write style back for `id`. Optional; needed only to turn a flag **off**
   * inside a node whose own `TextStyle` sets it. Run flags are additive, so
   * that edit is expressed by lowering the node flag and raising it on the
   * runs outside the selection — which needs somewhere to put the new node
   * style. Without this, such a toggle is declined and nothing changes, as
   * before. See `runs/flagRange`.
   */
  setStyle?: (id: string, style: TextStyle) => void;
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
   * n" stay distinguishable — a styling written at a collapsed caret arms
   * {@link UseTextEditReturn.pendingStyle} instead of restyling a range.
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
   * `selection` is `null`. A collapsed caret reports the styling *at* the
   * caret (the run to its left, or the run to its right at offset 0), which
   * is what the next typed character inherits.
   *
   * This does not include {@link UseTextEditReturn.pendingStyle}. A control
   * showing what the next character will look like wants both, merged in
   * that order; one showing what is already written wants only this.
   */
  rangeStyle: RangeStyle | null;
  /**
   * Styling armed at a collapsed caret, applied to the next character typed
   * and then dropped. `{}` when nothing is armed — which is always the case
   * while `selection` covers a real range, since a range is styled directly.
   *
   * Moving the caret abandons it, as in any other editor.
   */
  pendingStyle: RunStylePatch;
  /**
   * Write `patch` over `selection`. A no-op with no active edit or an empty
   * patch. Over a real range this restyles the runs under it; at a collapsed
   * caret it merges into `pendingStyle` instead, so the styling lands on
   * what gets typed next rather than on text the user didn't select.
   *
   * Lowering a flag the *node* sets is neither of those — a run cannot say
   * "not bold" — so it rewrites instead: the node flag is cleared and raised
   * on every run outside the range. That path can decline (a node at
   * `fontWeight: 900` has no run boolean to move it to), in which case
   * nothing is written.
   *
   * The caret survives, so a second style can be applied without
   * re-selecting, and `rangeStyle` reflects the write before this returns.
   */
  applyStyleToSelection: (patch: RunStylePatch) => void;
  /**
   * Toggle one styling over `selection` — set it if the range doesn't
   * uniformly carry it, clear it if it does. The shape a B / I / x² control
   * or a keyboard shortcut wants, and what this hook's own shortcuts call.
   */
  toggleStyle: (toggle: StyleToggle) => void;
}

/** In-place text editing via a contenteditable overlay positioned over the text node's screen-space pose. */
export function useTextEdit(
  opts: UseTextEditOptions,
): UseTextEditReturn {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [editingId, setEditingId] = useState<string | null>(null);
  // `applyStyleToSelection` needs the node being edited to reach its
  // `TextStyle`, and is called from event handlers rather than from render.
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editingId;
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // The overlay-follow loop is built inside the editing effect; the gate's
  // frame callback reaches it through this ref.
  const tickRef = useRef<() => void>(() => {});
  const frameLoop = useVisibleRaf(() => { tickRef.current(); });
  const initialCaretRef = useRef<number | 'all'>('all');
  const [selection, setSelection] = useState<TextEditSelection | null>(null);
  const [rangeStyle, setRangeStyle] = useState<RangeStyle | null>(null);
  const [pendingStyle, setPendingStyle] = useState<RunStylePatch>(NO_PENDING);
  /** The pending style, read synchronously by `beforeinput` — which fires
   *  well before React has re-rendered with the state above. */
  const pendingRef = useRef<RunStylePatch>(NO_PENDING);
  /** The caret offset the pending style was armed at, or `null` when nothing
   *  is armed. Publishing any other range abandons it. */
  const pendingAtRef = useRef<number | null>(null);

  const armPending = useCallback((next: RunStylePatch, at: number) => {
    const empty = Object.keys(next).length === 0;
    pendingRef.current = empty ? NO_PENDING : next;
    pendingAtRef.current = empty ? null : at;
    setPendingStyle(pendingRef.current);
  }, []);

  const dropPending = useCallback(() => {
    if (pendingAtRef.current === null) return;
    pendingRef.current = NO_PENDING;
    pendingAtRef.current = null;
    setPendingStyle(NO_PENDING);
  }, []);

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
    const collapsed = range.start === range.end;
    // A pending style belongs to the caret position it was armed at. Any
    // other range means the caret moved, which abandons it.
    if (pendingAtRef.current !== null
      && !(collapsed && range.start === pendingAtRef.current)) {
      dropPending();
    }
    selectionRef.current = range;
    setSelection((prev) => (sameSelection(prev, range) ? prev : range));
    const runs = domToRuns(overlay);
    setRangeStyle(collapsed
      ? styleAtCaret(runs, range.start)
      : styleAtRange(runs, range.start, range.end));
  }, [dropPending]);

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
    dropPending();
  }, [dropPending]);

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
    const runs = setRuns ? trimCaretHolder(domToRuns(overlay)) : [];
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
    if (!range) return;

    // Lowering a flag the node itself sets is not expressible additively —
    // the run algebra can only add — so it takes the rewrite in
    // `setFlagOverRange`: clear the node flag, raise it outside the range.
    // This is the one styling that reaches existing text from a collapsed
    // caret, and has to: "stop being bold from here on" is otherwise
    // unsayable in a bold node.
    const id = editingIdRef.current;
    const setStyle = optsRef.current.setStyle;
    const runs = domToRuns(overlay);
    const unsetFlag = id !== null && setStyle
      ? (Object.keys(patch) as FlagKey[]).find((key) =>
          patch[key] === false
          && nodeHasFlag(optsRef.current.getStyle(id) ?? {}, key))
      : undefined;
    if (unsetFlag !== undefined && id !== null && setStyle) {
      const nodeStyle = optsRef.current.getStyle(id) ?? {};
      const r = setFlagOverRange(runs, nodeStyle, range.start, range.end, unsetFlag, false);
      if (!r.applied) return;
      setStyle(id, r.style);
      writeRunsPreservingSelection(overlay, r.runs, range.start, range.end);
      publishRange(overlay, range);
      // The rewrite raised the flag on every existing run, so a caret sitting
      // at the end of one is now *inside* a flagged span and the next
      // character would be absorbed by it. Arming the `false` keeps it out:
      // it is not a storable run value, but it is enough to make
      // `beforeinput` open a fresh span, which `runsToDom` then emits bare.
      if (range.start === range.end) {
        armPending({ ...pendingRef.current, [unsetFlag]: false }, range.start);
      }
      restoreOverlayFocus(overlay, range);
      // Whatever else the patch carried still applies on its own terms.
      const rest = { ...patch };
      delete rest[unsetFlag];
      if (Object.keys(rest).length > 0) applyStyleToSelection(rest);
      return;
    }

    // A collapsed caret has no run to restyle, so the styling is armed for
    // the next character instead of silently doing nothing.
    if (range.start === range.end) {
      armPending(mergePending(pendingRef.current, patch), range.start);
      restoreOverlayFocus(overlay, range);
      return;
    }

    const next = applyStyleToRange(runs, range.start, range.end, patch);
    writeRunsPreservingSelection(overlay, next, range.start, range.end);
    restoreOverlayFocus(overlay, range);
    // Republish from the range we just styled, not from the DOM selection:
    // when the patch came from chrome the selection is in that control, and
    // re-reading it would leave a consumer showing the pre-patch styling.
    publishRange(overlay, range);
  }, [publishRange, armPending]);

  const toggleStyle = useCallback((toggle: StyleToggle) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const range = readSelectionOffsets(overlay) ?? selectionRef.current;
    if (!range) return;
    const runs = domToRuns(overlay);
    const id = editingIdRef.current;
    const nodeStyle = (id !== null ? optsRef.current.getStyle(id) : undefined) ?? {};
    // At a collapsed caret the styling in play is what the caret sits in plus
    // whatever is already armed, so pressing Cmd+B twice disarms rather than
    // arming a second time.
    const current = range.start === range.end
      ? { ...styleAtCaret(runs, range.start), ...pendingRef.current }
      : styleAtRange(runs, range.start, range.end);
    applyStyleToSelection(patchForToggle(current, toggle, nodeStyle));
  }, [applyStyleToSelection]);

  useEffect(() => {
    if (editingId == null) return;
    const { container, getText, getStyle, getPaint, getScreenPose } = optsRef.current;
    if (!container) return;

    const style = resolveTextStyle(getStyle(editingId), getPaint?.(editingId));
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
      const toggle = toggleForKey(e);
      if (toggle) {
        e.preventDefault();
        toggleStyle(toggle);
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
      const pending = pendingRef.current;
      if (Object.keys(pending).length > 0) {
        // Rebuild from the runs rather than splicing a span into the DOM.
        // `insertNode` at a caret sitting inside a run span nests the new
        // span *within* it, and `domToRuns` reads styling down the ancestor
        // chain — so a pending style that has to escape the surrounding run
        // (the `false` armed after a node-flag rewrite) would inherit exactly
        // the flag it exists to shed. Going through the algebra also gets
        // every run field for free, with no CSS written here.
        const at = readSelectionOffsets(overlay) ?? selectionRef.current;
        if (!at || at.start !== at.end) return;
        ie.preventDefault();
        const next = spliceRunAt(domToRuns(overlay), at.start, {
          ...pending, text: ie.data,
        } as StyledRun);
        const after = at.start + ie.data.length;
        writeRunsPreservingSelection(overlay, next, after, after);
        placeCaretBetweenRuns(overlay, next, after);
        dropPending();
        publishRange(overlay, { start: after, end: after });
        return;
      }
      ie.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      {
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

    // Follows the node's screen pose every frame — behind the visibility gate,
    // so an overlay left open in a background tab costs nothing.
    tickRef.current = () => {
      const pose = optsRef.current.getScreenPose(editingId);
      placeOverlay(overlay, pose, style);
      frameLoop.request();
    };
    frameLoop.request();

    return () => {
      frameLoop.cancel();
      tickRef.current = () => {};
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
  }, [editingId, commit, cancelEdit, syncSelection, clearSelection, frameLoop,
      toggleStyle, dropPending, publishRange]);

  return {
    editingId, startEdit, cancelEdit, commit, isEditing,
    selection, rangeStyle, pendingStyle, applyStyleToSelection, toggleStyle,
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
