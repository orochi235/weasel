/**
 * Union math behind `CanvasHelpers.getGestureBounds()`.
 *
 * `getGestureBounds` answers "where is the thing the user is dragging right
 * now, in total?" — a question every other lookup on `CanvasHelpers` can't
 * answer because they're keyed by node id, and a drag-to-insert has no node
 * yet. Canvas collects the parts (preview bounds per in-flight id, plus any
 * id-less nascent-insert AABBs) and folds them here.
 *
 * Kept free of tool / dispatcher types so it stays a pure geometry fold that
 * both `<Canvas>` and its tests can call without a render.
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

/**
 * Axis-align a `Bounds` that carries a `rotation`: returns the AABB of the
 * rotated rectangle, with `rotation` dropped. Follows the kit's rotation
 * convention (`poseRotationOf`): rotate about the unrotated AABB center.
 *
 * Unrotated input is returned as-is. This is what makes a union of a rotated
 * ghost honest — folding the *unrotated* box would under-report the extent of
 * a mid-rotate node exactly when the consumer is watching it move.
 */
export function axisAlignedBounds(b: Bounds): Bounds {
  const rotation = b.rotation;
  if (!rotation) {
    // Strip an explicit `rotation: 0` so callers can rely on the absence of
    // the field meaning "axis-aligned".
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height],
    [b.x, b.y + b.height],
  ];
  for (const [px, py] of corners) {
    const dx = px - cx;
    const dy = py - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Fold every part into one world-space AABB, skipping `null` / `undefined`
 * entries. Rotated parts are expanded via {@link axisAlignedBounds} first;
 * the result never carries a `rotation` (a union of several oriented boxes
 * has no single orientation to report).
 *
 * Returns `null` when nothing was contributed — the "no gesture in flight"
 * answer.
 */
export function unionGestureBounds(
  parts: Iterable<Bounds | null | undefined>,
): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const part of parts) {
    if (!part) continue;
    const b = axisAlignedBounds(part);
    any = true;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    const right = b.x + b.width;
    const bottom = b.y + b.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
