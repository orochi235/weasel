/**
 * The seam `<Canvas>` reads in-flight gesture state through, kept free of the
 * dispatcher itself so `<Canvas>` stays dispatcher-agnostic.
 */
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { OngoingOverlay } from '@weasel-js/routing';

/**
 * A source of in-flight preview state — an `OngoingHandle` from the
 * dispatcher's in-flight map. Readers merge several with first-non-null
 * semantics.
 *
 * @public
 */
export interface GesturePreviewSource {
  previewIds?(): Iterable<string> | null;
  /** Absent/null falls back to the node's effective pose, which is where a
   *  transform publishing to the scene's overrides puts it. */
  previewPose?(id: string): unknown;
  /** Companion to `previewPose` for actions that mutate node data (anchor
   *  edits on `data.path` nodes). Absent/null falls back to committed data. */
  previewData?(id: string): unknown;
  /** Subset of `previewIds` painted at full opacity rather than as a ghost —
   *  a layout sibling reflowing to its destination is not in flight. */
  previewOpaqueIds?(): Iterable<string> | null;
}

/**
 * Everything `<Canvas>` needs to know about in-flight gestures that it can't
 * see for itself: the live gesture state lives in the gesture dispatcher that
 * `<SceneCanvas>` creates. Bare `<Canvas>` consumers leave it unwired and get
 * the "no gesture in flight" answers.
 *
 * @public
 */
export interface GestureSource {
  /**
   * Ids the in-flight gesture is previewing, so the canvas can resolve each
   * one's preview bounds.
   *
   * Wider than `previewIdsExtra`, which honors `previewHidesSource: false`
   * because its job is deciding whose committed paint to suppress: a clone
   * ghost hides nothing yet still proposes content at the drag target.
   */
  ids(): Iterable<string> | null;
  /** World-space AABBs of in-flight gestures that have no scene id at all —
   *  a drag-to-insert, pre-commit. */
  bounds(): Iterable<Bounds> | null;
  /** Fires whenever the above can have changed. See
   *  `CanvasHelpers.subscribeGestures` for the published guarantee. */
  subscribe(fn: () => void): () => void;
  /** Monotonic counter bumped on the same events `subscribe` fires on. */
  getVersion(): number;
  /** The in-flight handles' preview surfaces, in dispatch order. What a ghost
   *  layer paints from — read off the draw envelope so a layer drawn for one
   *  view cannot report another's gesture. */
  previewSources(): readonly GesturePreviewSource[];
  /** The overlay shapes the in-flight handles publish — marquee, lasso, insert
   *  preview, raw commands. */
  overlays(): readonly OngoingOverlay[];
}
