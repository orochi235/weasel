/**
 * The dispatcher side of `<Canvas>`'s {@link GestureSource} seam.
 *
 * `<Canvas>` owns the `CanvasHelpers` gesture surface (`getGestureBounds`,
 * `subscribeGestures`, `getGestureVersion`) but knows nothing about the
 * gesture dispatcher — like `previewIdsExtra` / `previewPoseExtra`, the
 * dispatcher's contribution is wired in from `<SceneCanvas>`. This module is
 * the whole of that contribution:
 *
 *  - {@link dispatcherGestureIds} — every id any in-flight handle is
 *    previewing, so Canvas can resolve each one's preview bounds;
 *  - {@link dispatcherInsertBounds} — the AABBs of gestures that have no
 *    scene id at all (a drag-to-insert, pre-commit);
 *  - {@link createGestureSource} — those two plus the dispatcher's change
 *    signal, its in-flight preview surfaces and its published overlays,
 *    bundled into the object `<Canvas>` takes.
 *
 * `useDispatcherOverlayLayer` paints the same `insertPreview` overlays this
 * reads, and both size them through `insertPreviewExtent`, so the reported
 * bounds and the drawn preview can't disagree.
 */
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureSource } from '../gestureBounds';
import type { OngoingOverlay } from 'interactions/actions/invoker';
import { insertPreviewExtent } from '../insertPreviewExtent';

/**
 * Ids every in-flight handle is previewing.
 *
 * Deliberately *not* `previewIdsExtra`: that one honors
 * `previewHidesSource: false` because its job is deciding whose committed
 * paint to suppress. A clone ghost hides nothing yet still proposes content
 * at the drag target, so gesture bounds must count it.
 */
export function dispatcherGestureIds(dispatcher: Dispatcher | null | undefined): string[] {
  const out: string[] = [];
  if (!dispatcher) return out;
  for (const handle of dispatcher.getInFlightHandles()) {
    const ids = handle.previewIds?.();
    if (!ids) continue;
    for (const id of ids) out.push(id);
  }
  return out;
}

/**
 * World-space AABBs of in-flight gestures with no scene node yet — the
 * `insertPreview` overlay variant, sized by {@link insertPreviewExtent}.
 *
 * Only `insertPreview`. `marquee` and `lasso` are in-flight gestures with
 * geometry too, but they *select* rather than *propose content*: a consumer
 * sizing itself to the gesture (lbx-editor's live auto-length) must not grow
 * because the user swept a selection rectangle. `commands` is an opaque
 * draw-command escape hatch with no bounds to read.
 */
export function dispatcherInsertBounds(dispatcher: Dispatcher | null | undefined): Bounds[] {
  const out: Bounds[] = [];
  if (!dispatcher) return out;
  for (const handle of dispatcher.getInFlightHandles()) {
    const ov = handle.overlay?.();
    if (!ov || ov.kind !== 'insertPreview') continue;
    const b = insertPreviewExtent(ov).bounds;
    // A zero-area extent is the pointerdown frame before the first move.
    // Mirrors `useDispatcherOverlayLayer`'s skip, pencil exception included:
    // a pencil gesture can be meaningful at near-zero AABB (closed loop /
    // sub-threshold), so it reports its point rather than nothing.
    if (b.width === 0 && b.height === 0 && ov.shape !== 'pencil') continue;
    out.push({ x: b.x, y: b.y, width: b.width, height: b.height });
  }
  return out;
}

const NO_OP_UNSUBSCRIBE = (): void => {};

/**
 * Bundle a dispatcher into the {@link GestureSource} `<Canvas>` consumes.
 *
 * Reads the dispatcher through a getter rather than closing over it, so the
 * source can be built once and keep pointing at the live dispatcher across
 * re-renders. A `null` dispatcher yields the empty answers — no ids, no
 * bounds, a no-op subscription, version 0.
 */
export function createGestureSource(
  getDispatcher: () => Dispatcher | null | undefined,
): GestureSource {
  return {
    ids: () => dispatcherGestureIds(getDispatcher()),
    bounds: () => dispatcherInsertBounds(getDispatcher()),
    subscribe: (fn) => getDispatcher()?.subscribe(fn) ?? NO_OP_UNSUBSCRIBE,
    getVersion: () => getDispatcher()?.getVersion() ?? 0,
    previewSources: () => [...(getDispatcher()?.getInFlightHandles() ?? [])],
    overlays: () => {
      const out: OngoingOverlay[] = [];
      for (const handle of getDispatcher()?.getInFlightHandles() ?? []) {
        const ov = handle.overlay?.();
        if (ov) out.push(ov);
      }
      return out;
    },
  };
}

/**
 * The dispatcher's contribution to a view's overlay-aware lookups: which ids
 * an in-flight handle hides behind a ghost, and the pose it proposes for one.
 *
 * Separate from {@link createGestureSource} only because `<Canvas>` takes
 * these as two loose props rather than a bundle.
 */
export function createDispatcherPreviewSources(
  getDispatcher: () => Dispatcher | null | undefined,
): {
  previewIdsExtra: () => string[];
  previewPoseExtra: (id: string) => unknown;
} {
  return {
    // Handles that set `previewHidesSource: false` (clone, etc.) opt out —
    // their ghost still paints, but the source stays at its committed home.
    previewIdsExtra: () => {
      const out: string[] = [];
      for (const handle of getDispatcher()?.getInFlightHandles() ?? []) {
        if (handle.previewHidesSource === false) continue;
        const ids = handle.previewIds?.();
        if (!ids) continue;
        for (const id of ids) out.push(id);
      }
      return out;
    },
    previewPoseExtra: (id: string) => {
      for (const handle of getDispatcher()?.getInFlightHandles() ?? []) {
        const p = handle.previewPose?.(id);
        if (p != null) return p;
      }
      return null;
    },
  };
}
