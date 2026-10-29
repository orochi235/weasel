/**
 * In-place text editing via a contenteditable overlay positioned over the
 * text node's screen-space pose. Enter / blur commit; Shift+Enter inserts a
 * newline. The text layer should hide the node it's currently editing
 * (`isHidden: (n) => n.id === editingId`) so the overlay isn't drawn twice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import type { ResolvedTextStyle, TextStyle } from '@weasel-js/text';
import {
  numericWeight, resolveTextStyle, scriptMetricsFor,
} from '@weasel-js/text';
import { cssFontFamilyLoading } from '@weasel-js/font';
import { editEnd } from '@weasel-js/headless';
import { layoutTextPose } from '@weasel-js/text';
import type { StyledRun } from '@weasel-js/text';
import { domToRuns, type OverlayRunBase } from './domRuns';
import {
  applyStyleToRange, effectiveRangeStyle, nodeHasFlag, patchRangeStyle, rangeWeight, setFlagOverRange,
  styleAtRange, supersededKey, unboldPatch, type FlagKey, type RangeStyle, type RunStylePatch,
} from '@weasel-js/text';
import { overlayAlignEdge } from './overlayDirection';
import { draftChanged, overlayDraft, writeEdit } from './overlayDraft';
import { overlayClipPath, overlayTop, overlayTransform } from './overlayFrame';
export { overlayTop };
import { applyOverlayStyle } from './overlayStyle';
import { seedOverlay, type CaretHolder } from './overlaySeed';
import {
  readSelectionOffsets, restoreOverlayFocus, sameSelection, writeRunsPreservingSelection,
} from './overlaySelection';
import { typingHandlers } from './overlayTyping';
import { toggleForKey } from './styleShortcuts';
import { useEditingId } from './editSession';
import { TEXT_EDIT_FONT_HOLD } from './textEditTypes';
import type {
  StartEditOptions, StyleToggle, TextEditClipRect, TextEditScreenPose, TextEditSelection, UseTextEditOptions,
  UseTextEditReturn,
} from './textEditTypes';

/**
 * The patch that toggles `toggle` against the styling in `current`: if it is
 * already carried, clear it; otherwise set it — so a mixed range turns fully
 * on. `nodeStyle` is read as well as `current`: a node flag renders on every
 * run whether or not the runs carry it, so the runs alone would read Cmd+B
 * inside a `fontWeight: 700` node as "not bold" and *add* bold.
 */
function patchForToggle(
  current: RangeStyle,
  toggle: StyleToggle,
  nodeStyle: TextStyle,
): RunStylePatch {
  if (toggle === 'super' || toggle === 'sub') {
    return { script: current.script === toggle ? undefined : toggle };
  }
  const on = toggle === 'bold'
    ? rangeWeight(current, nodeStyle).bold === true
    : current[toggle] === true || nodeHasFlag(nodeStyle, toggle);
  return { [toggle]: !on };
}

/**
 * The styling at a collapsed caret: the run to its left, or — at the very
 * start of the text — the run to its right. This is what the next typed
 * character inherits.
 */
function styleAtCaret(runs: readonly StyledRun[], at: number): RangeStyle {
  return at > 0 ? styleAtRange(runs, at - 1, at) : styleAtRange(runs, 0, 1);
}

/** No pending style. One frozen object so re-publishing an already-empty
 *  pending style doesn't re-render every consumer. */
const NO_PENDING: RunStylePatch = Object.freeze({});

/**
 * Merge `patch` into a pending style. A key set to `false` or `undefined` is
 * deleted rather than stored, and bold and a weight supersede each other —
 * the canonical form a stored run keeps.
 */
function mergePending(prev: RunStylePatch, patch: RunStylePatch): RunStylePatch {
  const next: Record<string, unknown> = { ...prev };
  const superseded = supersededKey(patch);
  if (superseded !== undefined) delete next[superseded];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === false) delete next[key];
    else next[key] = value;
  }
  return next as RunStylePatch;
}

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
  /** The editing node's resolved style, which run spans inheriting small caps
   *  are split by whenever the runs are rewritten. */
  const baseRef = useRef<OverlayRunBase>(resolveTextStyle(undefined));
  const [nodeStyle, setNodeStyle] = useState<TextStyle | null>(null);
  /** `nodeStyle`, read synchronously by the handlers that rewrite and commit it. */
  const nodeStyleRef = useRef<TextStyle | null>(null);
  const holdNodeStyle = useCallback((style: TextStyle | null) => {
    nodeStyleRef.current = style;
    setNodeStyle(style);
  }, []);
  const styleOf = useCallback(
    (id: string): TextStyle | undefined => nodeStyleRef.current ?? optsRef.current.getStyle(id),
    [optsRef],
  );
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

  /** The published range, mirrored in a ref: the fallback when the DOM
   *  selection has moved into editing chrome. */
  const selectionRef = useRef<TextEditSelection | null>(null);

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
    // A selection outside the overlay means focus moved into a control, which
    // is when the range matters most: leave it published rather than clear it.
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
  }, [editingId, optsRef, holdNodeStyle, setEditingId]);

  const startEdit = useCallback((id: string, opts?: StartEditOptions) => {
    initialCaretRef.current = opts?.caret ?? 'all';
    setEditingId(id);
  }, [setEditingId]);

  const isEditing = useCallback((id: string) => editingId === id, [editingId]);

  const sendDraft = useCallback((overlay: HTMLElement) => {
    const id = editingIdRef.current;
    const draft = overlayDraft(domToRuns(overlay), holderRef.current, priorRunsRef.current, nodeStyleRef.current);
    if (id !== null && draftChanged(sentRef, draft)) optsRef.current.onDraft?.(id, draft);
  }, [editingIdRef, optsRef]);

  const applyStyleToSelection = useCallback(function applyStyle(patch: RunStylePatch) {
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
    const canWriteStyle = optsRef.current.setStyle !== undefined || optsRef.current.commit !== undefined;
    const runs = domToRuns(overlay);
    if (patch.bold === false && !('fontWeight' in patch) && id !== null) {
      patch = { ...patch, ...unboldPatch(styleOf(id) ?? {}) };
    }
    const unsetFlag = id !== null && canWriteStyle
      ? (Object.keys(patch) as FlagKey[]).find((key) =>
          key !== 'bold'
          && patch[key] === false
          && nodeHasFlag(styleOf(id) ?? {}, key))
      : undefined;
    if (unsetFlag !== undefined && id !== null) {
      const r = setFlagOverRange(runs, styleOf(id) ?? {}, range.start, range.end, unsetFlag, false);
      holdNodeStyle(r.style);
      // The root's own decoration and slant reach every run by inheritance,
      // the range just cleared included.
      const resolved = resolveTextStyle(r.style, optsRef.current.getPaint?.(id));
      baseRef.current = resolved;
      applyOverlayStyle(overlay, resolved);
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
      armPending(mergePending(pendingRef.current, patch), range.start);
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
  }, [publishRange, armPending, editingIdRef, optsRef, styleOf, holdNodeStyle, sendDraft]);

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
      ? patchRangeStyle(styleAtCaret(runs, range.start), pendingRef.current)
      : styleAtRange(runs, range.start, range.end);
    applyStyleToSelection(patchForToggle(current, toggle, nodeStyle));
  }, [applyStyleToSelection, editingIdRef, styleOf]);

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
    const hold = holdForFaces(style, initialRuns ?? []);
    if (hold) overlay.style.opacity = '0';
    const styleEl = installSelectionStyle(overlayClass, style);
    const clipBox = createClipBox();
    clipBox.appendChild(overlay);
    container.appendChild(clipBox);
    overlayRef.current = overlay;

    const place = () => {
      const clip = optsRef.current.getClipRect?.() ?? null;
      placeOverlay(overlay, clipBox, optsRef.current.getScreenPose(editingId), clip, style);
    };
    place();
    // Measured again on release: the first `place` ran in the fallback face.
    let held = hold !== null;
    const release = () => {
      if (!held) return;
      held = false;
      clearTimeout(holdTimer);
      place();
      overlay.style.opacity = '';
    };
    const holdTimer = held ? setTimeout(release, optsRef.current.fontHold ?? TEXT_EDIT_FONT_HOLD) : undefined;
    void hold?.then(release);

    const range = document.createRange();
    const initial = initialCaretRef.current;
    if (initial === 'all') {
      range.selectNodeContents(overlay);
    } else {
      placeCaretAt(overlay, range, initial);
    }
    // Focus first, then place the caret: focusing an editable host itself
    // moves the selection (jsdom collapses to the start; browsers vary).
    overlay.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Publish now rather than on the `selectionchange` task — a control mounted
    // alongside the editor would otherwise render one frame with no selection.
    syncSelection();

    const onKeyDown = (e: KeyboardEvent) => {
      // The key belongs to the IME: Enter confirms a candidate, Escape dismisses
      // them. Safari reports it after `compositionend`, as keyCode 229.
      if (e.isComposing || e.keyCode === 229) return;
      const ends = editEnd({ key: e.key, shift: e.shiftKey }, { escape: optsRef.current.escape, multiline: true });
      if (ends) {
        e.preventDefault();
        if (ends === 'commit') commit();
        else cancelEdit();
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

    const { onBeforeInput, onInput } = typingHandlers(overlay, {
      pending: () => pendingRef.current,
      base: () => baseRef.current,
      lastRange: () => selectionRef.current,
      onWritten: (caret) => {
        dropPending();
        publishRange(overlay, { start: caret, end: caret });
      },
      onEdited: () => {
        holderRef.current?.edited(overlay);
        place();
        sendDraft(overlay);
      },
    });

    // Blur can't be the only way out: once focus has moved into editing
    // chrome, nothing blurs when the user clicks away. Capture phase so this
    // runs ahead of whatever the click was aimed at.
    const onPointerDownOutside = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node) || overlay.contains(target)) return;
      if (isChrome(optsRef.current, target)) return;
      commit();
    };

    overlay.addEventListener('keydown', onKeyDown);
    overlay.addEventListener('blur', onBlur);
    // Typing can change the line count; re-placing here rather than on the
    // next frame keeps a center/bottom-aligned overlay from jumping a frame late.
    overlay.addEventListener('input', onInput);
    overlay.addEventListener('beforeinput', onBeforeInput);
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
      clearTimeout(holdTimer);
      frameLoop.cancel();
      tickRef.current = () => {};
      overlay.removeEventListener('keydown', onKeyDown);
      overlay.removeEventListener('blur', onBlur);
      overlay.removeEventListener('input', onInput);
      overlay.removeEventListener('beforeinput', onBeforeInput);
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('selectionchange', syncSelection);
      clipBox.remove();
      styleEl?.remove();
      overlayRef.current = null;
      holdNodeStyle(null);
      clearSelection();
    };
  }, [editingId, opts.container, optsRef, commit, cancelEdit, syncSelection, clearSelection,
      frameLoop, toggleStyle, dropPending, publishRange, holdNodeStyle, sendDraft]);

  return {
    editingId, startEdit, cancelEdit, commit, isEditing, nodeStyle,
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
    patchRangeStyle(rangeStyle ?? {}, pendingStyle),
    nodeStyle ?? opts.getStyle(editingId),
    opts.getPaint?.(editingId),
  );
}

let OVERLAY_SEQ = 0;

/**
 * The loads the overlay's faces are still waiting on — the node's and each
 * run's that names its own family — or `null` when every one is in hand.
 */
function holdForFaces(style: ResolvedTextStyle, runs: readonly StyledRun[]): Promise<unknown> | null {
  const pending = [
    cssFontFamilyLoading(style.fontFamily, {
      weight: numericWeight(style.fontWeight), style: style.fontStyle,
    }),
    ...runs.filter((r) => r.fontFamily != null).map((r) => cssFontFamilyLoading(r.fontFamily!, {
      weight: r.fontWeight ?? (r.bold ? 700 : undefined),
      style: r.italic ? 'italic' : undefined,
    })),
  ].filter((p) => p !== null);
  return pending.length === 0 ? null : Promise.all(pending);
}

/**
 * Place a collapsed caret `offset` characters into the overlay's text,
 * walking its text nodes. Out-of-range offsets clamp to the end.
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
  range.selectNodeContents(root);
  range.collapse(false);
}

/** The overlay's positioning parent. Passes pointer input through everywhere
 *  but the overlay itself, which spans no more than the canvas it covers. */
function createClipBox(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  el.style.pointerEvents = 'none';
  return el;
}

/**
 * Inject a `<style>` element scoped to `overlayClass` so the edit overlay's
 * `::selection` matches the configured colors, or `null` when none are set.
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

const ALIGN_ANCHOR = { left: 0, center: 0.5, right: 1 } as const;

/**
 * The canvas and CSS both hang a line's baseline half the leading plus one
 * ascent below the line top, from the same ascent rule, but each engine
 * rounds the font's metrics and that leading its own way, and a face that
 * states no ascent and descent hangs from its ascent alone. So the difference
 * is read from both sides rather than predicted: the canvas's from its own layout, the
 * overlay's from a zero-height inline box on a hidden line set exactly as the
 * overlay is. Pre-scale; `0` when either side has nothing to measure.
 * @internal
 */
export function baselineDrop(el: HTMLElement, style: ResolvedTextStyle, pose: TextEditScreenPose, lineHeight: number): number {
  const canvas = layoutTextPose({
    x: 0, y: 0, width: pose.width, height: pose.height, text: ' ',
    style: {
      fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
      fontSize: pose.fontSize, lineHeight, script: style.script,
    },
  }).laid.lines[0]?.baselineY ?? 0;
  const css = cssBaseline(el);
  return canvas > 0 && css > 0 ? canvas - css : 0;
}

const CSS_BASELINES = new Map<string, number>();

function cssBaseline(el: HTMLElement): number {
  const parent = el.parentElement;
  if (!parent) return 0;
  const { fontFamily, fontWeight, fontStyle, fontSize, lineHeight, textRendering } = el.style;
  const key = [fontFamily, fontWeight, fontStyle, fontSize, lineHeight, textRendering].join('|');
  const cached = CSS_BASELINES.get(key);
  if (cached !== undefined) return cached;
  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'absolute', left: '0', top: '0', width: '100px', margin: '0', padding: '0', border: '0',
    visibility: 'hidden', whiteSpace: 'pre', fontFamily, fontWeight, fontStyle, fontSize, lineHeight, textRendering,
  });
  const mark = document.createElement('span');
  Object.assign(mark.style, { display: 'inline-block', width: '0', height: '0', verticalAlign: 'baseline' });
  line.appendChild(mark);
  parent.appendChild(line);
  const box = line.getBoundingClientRect();
  // Rect over layout width undoes any transform on an ancestor.
  const scale = box.width / 100;
  const baseline = scale > 0 ? (mark.getBoundingClientRect().top - box.top) / scale : 0;
  line.remove();
  // A web font still loading is measured as its fallback; ask again later.
  if (baseline > 0 && document.fonts?.status !== 'loading') {
    if (CSS_BASELINES.size >= 64) CSS_BASELINES.clear();
    CSS_BASELINES.set(key, baseline);
  }
  return baseline;
}

function placeOverlay(
  el: HTMLDivElement,
  clipBox: HTMLDivElement,
  pose: TextEditScreenPose | null,
  clip: TextEditClipRect | null,
  style: ResolvedTextStyle,
): void {
  if (!pose) {
    el.style.display = 'none';
    return;
  }
  // `clip` rather than `hidden`: a `hidden` box is still scrollable, and the
  // browser scrolls it to keep the caret in view.
  clipBox.style.overflow = clip ? 'clip' : 'visible';
  clipBox.style.left = `${clip?.x ?? 0}px`;
  clipBox.style.top = `${clip?.y ?? 0}px`;
  clipBox.style.width = `${clip?.width ?? 0}px`;
  clipBox.style.height = `${clip?.height ?? 0}px`;
  el.style.display = '';
  // An unwrapped line can be wider than its box, and the canvas aligns it
  // about the box's left edge, center, or right edge regardless. `left` puts
  // that anchor there and a trailing translate pulls the overlay back by that
  // fraction of its own width.
  const anchor = style.wrap ? 0 : ALIGN_ANCHOR[overlayAlignEdge(el, style)];
  const left = pose.x + pose.width * (pose.zoom ?? 1) * anchor;
  el.style.left = `${left - (clip?.x ?? 0)}px`;
  el.style.width = style.wrap ? `${pose.width}px` : 'max-content';
  el.style.minWidth = style.wrap ? '' : `${pose.width}px`;
  // A node-level script draws the glyphs smaller and raised on the line the
  // plain text would hold, so the line height is pinned in pixels of the
  // unscripted size rather than left to scale with the font.
  const script = style.script
    ? scriptMetricsFor(style.fontFamily, numericWeight(style.fontWeight), style.fontStyle)[style.script]
    : undefined;
  const lineHeight = pose.lineHeight ?? style.lineHeight;
  el.style.fontSize = `${pose.fontSize * (script?.size ?? 1)}px`;
  el.style.lineHeight = script ? `${pose.fontSize * lineHeight}px` : String(lineHeight);
  // A top-aligned overlay fills its box, so a click anywhere in it lands in
  // the editor. Any other alignment needs the content's own height, which a
  // min-height would mask; `offsetHeight` is pre-transform, in pose units.
  const aligned = pose.verticalAlign !== undefined && pose.verticalAlign !== 'top';
  el.style.minHeight = aligned ? '' : `${pose.height}px`;
  const drop = baselineDrop(el, style, pose, lineHeight) - (script?.shift ?? 0) * pose.fontSize;
  const top = overlayTop(pose, aligned ? el.offsetHeight : pose.height, drop);
  el.style.top = `${top - (clip?.y ?? 0)}px`;
  // A declared `zoom` means every size on the pose is pre-scale and the
  // overlay carries the view scale as a transform. Anchored at the top-left so
  // `left`/`top` stay screen pixels.
  el.style.transformOrigin = '0 0';
  el.style.transform = overlayTransform(pose, left, top, anchor);
  el.style.clipPath = pose.clip ? overlayClipPath(el, pose, left, top, anchor, pose.clip) : '';
  // `letter-spacing` is not part of the CSS `font` shorthand. Under a
  // transform the world value is the value. Without one, `pose.fontSize` is
  // `style.fontSize * zoom`, so their ratio is the world→screen factor; run
  // overrides, which `runsToDom` writes in world units, then stay unscaled,
  // so that path is only correct at zoom 1.
  const scale =
    pose.zoom !== undefined ? 1 : style.fontSize > 0 ? pose.fontSize / style.fontSize : 1;
  el.style.letterSpacing = `${style.letterSpacing * scale}px`;
}
