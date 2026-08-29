/**
 * The seam `<Canvas>` reads in-flight gesture state through.
 *
 * `getGestureBounds` answers "where is the thing the user is dragging right
 * now, in total?" — a question every other lookup on `CanvasHelpers` can't
 * answer because they're keyed by node id, and a drag-to-insert has no node
 * yet. `<Canvas>` collects the parts named here and folds them with
 * `unionAABB` (`core/geometry/unionBounds`).
 *
 * Kept free of tool / dispatcher types so `<Canvas>` stays dispatcher-agnostic:
 * it owns the `CanvasHelpers` contract, and the live gesture state lives in
 * the dispatcher.
 */
import type { Bounds } from 'core/viewport/fitViewToBounds';

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
}
