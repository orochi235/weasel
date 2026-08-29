/**
 * The seam `<Canvas>` reads in-flight gesture state through.
 *
 * `getGestureBounds` answers "where is the thing the user is dragging right
 * now, in total?" — a question every other lookup on `CanvasHelpers` can't
 * answer because they're keyed by node id, and a drag-to-insert has no node
 * yet. `<Canvas>` collects the parts named here and folds them with
 * `unionAABB` (`core/geometry/unionBounds`).
 *
 * Kept free of the dispatcher itself so `<Canvas>` stays dispatcher-agnostic:
 * it owns the `CanvasHelpers` contract, and the live gesture state lives in
 * the dispatcher. The overlay and preview shapes an action publishes are data,
 * and travel through here as such.
 */
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { OngoingOverlay } from 'interactions/actions/invoker';

/**
 * A source of in-flight preview state — a tool from the tools registry, or an
 * `OngoingHandle` from the dispatcher's in-flight map. Readers merge several
 * with first-non-null semantics.
 *
 * @public
 */
export interface GesturePreviewSource {
  previewIds?(): Iterable<string> | null;
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
 * see for itself.
 *
 * `<Canvas>` is deliberately dispatcher-agnostic — it owns the union math and
 * the `CanvasHelpers` contract, but the live gesture state lives in the
 * gesture dispatcher that `<SceneCanvas>` creates. This is the one seam
 * between them (`createGestureSource` in `SceneCanvas/dispatcherGestureBounds.ts`
 * builds it); bare `<Canvas>` consumers leave it unwired and get the
 * "no gesture in flight" answers.
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
