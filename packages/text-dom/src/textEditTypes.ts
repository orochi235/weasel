/** The option, return, and pose types of `useTextEdit`. */
import type {
  FlagKey, RangeStyle, RunStylePatch, StyledRun, TextPaint, TextStyle, TextVerticalAlign,
} from '@weasel-js/text';

/**
 * A styling a shortcut or a control toggles. The additive booleans, plus the
 * two `script` values — which are exclusive rather than additive, so they
 * toggle against one enum rather than each owning a boolean.
 */
export type StyleToggle = FlagKey | 'super' | 'sub';

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
   * Where the text sits within `height`, as the canvas places it. `'center'`
   * and `'bottom'` size the overlay to its own content and offset it by the
   * slack, re-measured as typing changes the line count. Default `'top'`.
   */
  verticalAlign?: TextVerticalAlign;
  /**
   * CSS scale applied to the overlay (`transform: scale(zoom)`, anchored at
   * its top-left). Every other size on this pose, and every typographic
   * metric the hook writes, is then **pre-scale** — pass world units and the
   * transform does the world→screen conversion.
   *
   * This is the only way run-level typography can be correct at a zoom other
   * than 1. Omit it (the default, `1`) and the pose is plain screen pixels —
   * the hook then infers the world→screen factor from
   * `fontSize / style.fontSize` to scale node-level `letterSpacing`, and
   * run-level overrides are left unscaled.
   */
  zoom?: number;
  /**
   * The frame the text is drawn in, when its box is turned or skewed: the
   * linear part `[a, b, c, d]` (`x' = a·x + c·y`, `y' = b·x + d·y`) applied
   * about the box's center. `x`, `y`, `width`, and `height` stay those of
   * the box before it. Absent is the identity.
   */
  frame?: readonly [a: number, b: number, c: number, d: number];
  /**
   * Cut the overlay's text at the box `x`/`y`/`width`/`height` name, grown by
   * these on each side, in the same pre-scale units. It turns with `frame`,
   * so it holds to the box as the canvas draws it. Absent, the text may run
   * past the box, cut only by `getClipRect`.
   */
  clip?: { top: number; right: number; bottom: number; left: number };
}

/** A box in CSS pixels relative to `useTextEdit`'s `container`. */
export interface TextEditClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What one edit session changed, as `UseTextEditOptions.commit` receives it. */
export interface TextEditCommit {
  text: string;
  runs?: StyledRun[];
  /** The node's own style, where the edit rewrote it. */
  style?: TextStyle;
}

/** What the overlay holds mid-edit, as {@link UseTextEditOptions.onDraft} reports it: what a commit would write now. */
export type TextEditDraft = TextEditCommit;

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
   * style. Without this or `commit`, such a toggle is declined and nothing
   * changes. See `flagRange` in `@weasel-js/text`.
   *
   * Called when the edit commits, never during it: the session holds the
   * rewritten style until then (see `UseTextEditReturn.nodeStyle`), so a
   * canceled edit writes nothing.
   */
  setStyle?: (id: string, style: TextStyle) => void;
  /** Read screen-space pose for `id`. Called per frame while editing. */
  getScreenPose: (id: string) => TextEditScreenPose | null;
  /**
   * The box, in CSS pixels relative to `container`, the overlay is visible
   * within — where the canvas clips the glyphs the overlay stands in for.
   * Re-read every frame. Omit it, or return `null`, to clip nothing.
   *
   * The clip cannot scroll, so a caret moving past its edge leaves the page
   * where it is; a scrollable container would drag the canvas after the caret.
   */
  getClipRect?: () => TextEditClipRect | null;
  /** Commit text. Caller wraps in op/undo. Required unless `commit` is given. */
  setText?: (id: string, text: string) => void;
  /**
   * Take the whole edit in one call, so the caller can make it one write and
   * one undo step. When given, it replaces `setText`, `setRuns`, and
   * `setStyle`, none of which is called. `runs` is present when runs are in
   * play (see `setRuns`), `style` when the edit rewrote the node's own style
   * (see `setStyle`).
   */
  commit?: (id: string, edit: TextEditCommit) => void;
  /**
   * Called on each edit to the overlay's text, and on each restyle of it, with
   * what a commit would write now: `runs` present when runs are in play (see
   * `setRuns`), `style` when the edit rewrote the node's own. For a host
   * whose canvas shows the text somewhere besides the overlay, such as a copy
   * laid along a path, to follow the typing. Not a commit: a cancel follows
   * as it would without it.
   */
  onDraft?: (id: string, draft: TextEditDraft) => void;
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
   * plain-text node still calls `setText` alone.
   */
  setRuns?: (id: string, runs: StyledRun[]) => void;
  /**
   * Is `el` part of the editor's own chrome — a character-options bar, a
   * color popover, anything whose whole purpose is to style the text being
   * edited? Focus moving into one does not end the edit.
   *
   * Without this, clicking a size field blurs the overlay, blur commits, and
   * the caret the control was about to act on is gone. Toggle buttons can
   * dodge it by `preventDefault()`-ing their own mousedown, but a field the
   * user has to type into cannot.
   *
   * Chrome focus does not disturb the reported `selection` either — see
   * `UseTextEditReturn.selection`.
   */
  isEditorChrome?: (el: Element) => boolean;
  /** What Escape does to the edit: `'cancel'` (the default) drops it,
   *  `'commit'` keeps the text as Enter would. */
  escape?: 'cancel' | 'commit';
  /** Called as an edit of `id` opens, from the call that opens it. */
  onStart?: (id: string) => void;
  /**
   * Called as the edit of `id` closes, however it does: a commit, a cancel,
   * a click away, or another edit opening over it. A commit has been written
   * by then. Not called when the hook unmounts with an edit open.
   */
  onEnd?: (id: string) => void;
  /**
   * How long, in ms, an edit opening waits for the overlay's face before
   * showing the text in the fallback. Defaults to {@link TEXT_EDIT_FONT_HOLD}.
   *
   * The overlay stands in for canvas text the host has hidden, so the wait
   * shows nothing at all; past it, the fallback shows and reflows to the real
   * face when that lands. A face already loaded shows at once. `0` never waits.
   */
  fontHold?: number;
}

/**
 * The default {@link UseTextEditOptions.fontHold}: at 100ms a blank edit
 * still reads as an instant response, and it is the block period CSS gives
 * `font-display: fallback` for the same trade.
 */
export const TEXT_EDIT_FONT_HOLD = 100;

/** Options for `useTextEdit().startEdit`. */
export interface StartEditOptions {
  /** Where to place the caret on edit start. Number = caret offset (0..text.length);
   *  `'all'` selects the whole text (default). */
  caret?: number | 'all';
}

/** Return shape of `useTextEdit`. */
export interface UseTextEditReturn {
  editingId: string | null;
  startEdit: (id: string, opts?: StartEditOptions) => void;
  cancelEdit: () => void;
  /** End the edit and write it. An edit that leaves the text, the runs, and
   *  the node's style as it found them writes nothing. */
  commit: () => void;
  isEditing: (id: string) => boolean;
  /**
   * The node-wide style this edit has rewritten and not yet written back, or
   * `null` when it has rewritten none (the node's own style stands) or
   * nothing is being edited. Lowering a flag the node sets rewrites it; the
   * write waits for the commit. A control showing the node's style during an
   * edit reads this first.
   */
  nodeStyle: TextStyle | null;
   /**
   * The caret's character range, or `null` when nothing is being edited. A
   * collapsed caret reports `{ start: n, end: n }`, so `null` and "caret at
   * n" stay distinguishable — a styling written at a collapsed caret arms
   * {@link UseTextEditReturn.pendingStyle} instead of restyling a range.
   *
   * Follows the DOM selection, which browsers report from a task
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
   * Moving the caret abandons it.
   */
  pendingStyle: RunStylePatch;
  /**
   * What a styling control shows during an edit: the node's own style and
   * paint, `rangeStyle` over it, and `pendingStyle` last — what the user
   * will see themselves type. `null` when nothing is being edited.
   */
  effectiveStyle: RangeStyle | null;
  /**
   * Write `patch` over `selection`. A no-op with no active edit or an empty
   * patch. Over a real range this restyles the runs under it; at a collapsed
   * caret it merges into `pendingStyle` instead, so the styling lands on
   * what gets typed next rather than on text the user didn't select.
   *
   * Lowering a flag the *node* sets is neither of those — a run cannot say
   * "not italic" — so it rewrites instead: the node flag is cleared and raised
   * on every run outside the range. Bold is spared that: a run's own
   * `fontWeight` can say "regular", so it is written over the range.
   *
   * The caret survives, so a second style can be applied without
   * re-selecting, and `rangeStyle` reflects the write before this returns.
   */
  applyStyleToSelection: (patch: RunStylePatch) => void;
  /** Toggle one styling over `selection` — set it if the range doesn't
   *  uniformly carry it, clear it if it does. */
  toggleStyle: (toggle: StyleToggle) => void;
}
