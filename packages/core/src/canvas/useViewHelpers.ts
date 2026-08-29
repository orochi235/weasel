import { useCallback, useMemo, useRef } from 'react';
import { firstPreviewPose, firstPreviewBounds, aggregatePreviewIds, toolPreviewSources } from './toolPreview';
import type { GestureSource, GesturePreviewSource } from './gestureBounds';
import type { OngoingOverlay } from 'interactions/actions/invoker';
import { unionAABB } from 'core/geometry/unionBounds';
import { buildChromeState, type ChromeState } from 'core/selection/chromeState';
import type { PoseProjection } from 'interactions/actions/resize/geometry';
import type { NodeId } from 'core/scene/types';
import type { ToolsApi } from 'tools/useTools';
import type { DebugSink } from '../debug/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

const noOpUnsubscribe = (): void => {};

const alwaysVisible = (): boolean => true;

/**
 * The half of {@link CanvasHelpers} that belongs to one view — everything
 * answered by a camera's own tools, gestures and selection. A canvas hosting
 * several viewports needs one of these per view; the surface half is shared.
 */
export interface CanvasViewHelpers<TPose> {
  /** Pose currently displayed for `id` — drag/resize/rotate overlay if active,
   *  otherwise the committed pose from the adapter. Returns `null` if the id
   *  isn't known. */
  getEffectivePose(id: string): TPose | null;
  /** Overlay-aware bounds for `id`. */
  getEffectiveBounds(id: string): Bounds | null;
  /**
   * World-space AABB of everything the in-flight gesture proposes — the
   * displaced poses of nodes being moved / resized / rotated / cloned, plus
   * any nascent insert that has no scene node yet. `null` when no gesture is
   * in flight.
   *
   * This reports the *gesture*, not the document: committed content the
   * gesture isn't touching is excluded, so a consumer that wants the union
   * with the rest of the scene still walks its own ids through
   * `getEffectiveBounds`. It exists because every other lookup here is keyed
   * by node id, which can't answer "where is the shape the user is drawing
   * right now" — a drag-to-insert has no id until pointer-up.
   *
   * Select-only gestures are deliberately excluded: a marquee or lasso has
   * geometry but proposes no content, and a consumer sizing itself to the
   * gesture must not grow because the user swept a selection rectangle.
   *
   * The result is a plain AABB — never rotated. Rotated parts are folded in
   * by their rotated extent (a union of several oriented boxes has no single
   * orientation to report).
   */
  getGestureBounds(): Bounds | null;
  /**
   * Subscribe to the gesture layer's change signal — the other half of the
   * `useSyncExternalStore` contract for everything on this object that moves
   * during a drag (`getEffectivePose`, `getEffectiveBounds`,
   * `getGestureBounds`). Returns an unsubscribe.
   *
   * Fires once per dispatcher pump: gesture start, every pointermove that
   * reaches an in-flight handle, end, and cancel — plus UI-driven ongoing
   * actions (a slider bound to an ongoing action pumps the same way). It
   * fires on the pump, not on a diff: a pump that changed nothing observable
   * still notifies, so don't hang expensive work directly off the callback.
   *
   * It does **not** cover committed scene edits (subscribe to the scene for
   * those) or previews a consumer's own tool publishes from React state
   * (that tool re-renders on its own).
   *
   * Without a gesture source wired — a bare `<Canvas>` — this is a no-op
   * subscription that never fires.
   */
  subscribeGestures(fn: () => void): () => void;
  /**
   * Monotonic counter bumped on exactly the events `subscribeGestures` fires
   * on. Pair the two for `useSyncExternalStore`:
   *
   * ```ts
   * const gestureVersion = useSyncExternalStore(
   *   useCallback((cb) => helpersRef.current?.subscribeGestures(cb) ?? (() => {}), []),
   *   () => helpersRef.current?.getGestureVersion() ?? 0,
   * );
   * ```
   *
   * Starts at 0 and only increases. `0` is also what a bare `<Canvas>` with
   * no gesture source reports, forever.
   */
  getGestureVersion(): number;
  /** Returns the live ChromeState built once per render. Affordances and
   *  custom layers that need overlay-aware selection state (selection ids,
   *  bounds, multi-union AABB, modifier flags) read from this. */
  getChromeState(): ChromeState;
  /**
   * Everything publishing an in-flight preview for this view, in resolution
   * order: tool-side first (hotkey → active → registry → ambient), then the
   * handles in flight on this view's dispatcher. Readers take the first
   * non-null answer per id.
   *
   * A ghost layer must read this off its draw envelope rather than close over
   * a dispatcher: one layer array paints every view, so a closure ghosts view
   * zero's drag into every panel.
   */
  getPreviewSources(): readonly GesturePreviewSource[];
  /** Overlay shapes this view's in-flight handles publish — marquee, lasso,
   *  insert preview, raw commands. Same envelope rule as
   *  {@link CanvasViewHelpers.getPreviewSources}. */
  getGestureOverlays(): readonly OngoingOverlay[];
  /**
   * Chrome-caps visibility predicate, keyed by chrome id. Overlay layers and
   * affordances call it per element to decide whether to draw / hit-test.
   *
   * The rule table is the surface's; the context it resolves against is this
   * view's selection, camera and in-flight action — so the predicate belongs
   * here rather than on {@link CanvasSurfaceHelpers}. Unwired, it is the
   * universal `() => true`.
   */
  getIsVisible(): (id: string) => boolean;
}

/**
 * The half of {@link CanvasHelpers} that belongs to the surface — one GL
 * context, one debug sink, however many views are drawn on it.
 */
export interface CanvasSurfaceHelpers {
  /** Active debug sink, when `<Canvas debug=...>` is enabled. Layers that
   *  want to participate in `hitboxes`/`bounds`/etc. visualization can
   *  call into this from their `draw` callback. Returns `null` when
   *  debug is off — no-op for production renders. */
  getDebug(): DebugSink | null;
}

/** Live overlay-aware lookups exposed to custom layers via `helpersRef`.
 *  What a layer receives as its `data` argument, unchanged: the two halves
 *  are split so a per-view set can be built independently of the surface's,
 *  not to make layers ask for one. */
export interface CanvasHelpers<TPose> extends CanvasViewHelpers<TPose>, CanvasSurfaceHelpers {}

export interface UseViewHelpersOpts<TPose> {
  /** Only `getPose` is read here — the narrow slice keeps this hook off the
   *  full adapter contract. */
  adapter: { getPose(id: string): TPose } | undefined;
  geometry: PoseProjection<TPose>;
  /** Consumer-supplied bounds resolver. Falls back to the adapter's pose. */
  boundsOf: ((id: string) => Bounds | null) | undefined;
  selection: readonly NodeId[];
  tools: ToolsApi | undefined;
  gestureSource: GestureSource | undefined;
  /** Dispatcher-published preview overlays, read through a ref so a change
   *  mid-gesture doesn't rebuild the memos that depend on them. */
  previewPoseExtra: ((id: string) => unknown) | undefined;
  previewIdsExtra: (() => Iterable<string> | null) | undefined;
  /** Chrome-caps predicate for this view. Absent means everything is visible. */
  getIsVisible?: (() => (id: string) => boolean) | undefined;
}

export interface ViewHelpersBundle<TPose> {
  helpers: CanvasViewHelpers<TPose>;
  chromeState: ChromeState;
  /** Committed pose straight from the adapter, no overlay applied. */
  committedPoseOf(id: string): TPose | null;
  /** Bounds resolver after the `boundsOf` / adapter fallback, before previews. */
  effectiveBoundsOf: ((id: string) => Bounds | null) | undefined;
  previewToolPose(id: string): TPose | null;
  previewToolBounds(id: string): Bounds | null;
  /** Live dispatcher preview extras, for callers outside this bundle. */
  previewExtraRef: React.MutableRefObject<{
    previewPoseExtra: ((id: string) => unknown) | undefined;
    previewIdsExtra: (() => Iterable<string> | null) | undefined;
  }>;
}

/**
 * Build one view's overlay-aware state: its chrome and the lookups its layers
 * draw and hit-test against.
 *
 * This is a hook, so it runs once per component. That is the point — N views
 * cannot be a loop inside one component, but they can be N components each
 * calling this once.
 */
export function useViewHelpers<TPose>(
  opts: UseViewHelpersOpts<TPose>,
): ViewHelpersBundle<TPose> {
  const {
    adapter, geometry, boundsOf, selection, tools, gestureSource,
    previewPoseExtra, previewIdsExtra, getIsVisible,
  } = opts;

  const baseBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!adapter) return undefined;
    return (id: string): Bounds | null => {
      try {
        const pose = adapter.getPose(id);
        const b = geometry.getBounds(pose);
        const rot = geometry.getRotation?.(pose);
        return rot ? { ...b, rotation: rot } : b;
      } catch {
        return null;
      }
    };
  }, [boundsOf, adapter, geometry]);

  const committedPoseOf = useCallback((id: string): TPose | null => {
    if (!adapter) return null;
    try {
      return adapter.getPose(id);
    } catch {
      return null;
    }
  }, [adapter]);

  const multiActive = selection.length > 1;

  const previewExtraRef = useRef({ previewPoseExtra, previewIdsExtra });
  previewExtraRef.current = { previewPoseExtra, previewIdsExtra };

  const effectiveBoundsOf = useMemo(() => boundsOf ?? baseBoundsOf, [boundsOf, baseBoundsOf]);

  // The live overlay a gesture proposes for `id`: the active tool's published
  // preview first, then the dispatcher's preview extras. `null` when nothing
  // is mid-gesture — callers fall through to committed state.
  const previewToolPose = useCallback((id: string): TPose | null => {
    if (tools) {
      const p = firstPreviewPose(tools, id);
      if (p != null) return p as TPose;
    }
    const extra = previewExtraRef.current.previewPoseExtra;
    if (extra) {
      const p = extra(id);
      if (p != null) return p as TPose;
    }
    return null;
  }, [tools]);
  const previewToolBounds = useCallback((id: string): Bounds | null => {
    if (tools) {
      const b = firstPreviewBounds(tools, id);
      if (b) return b;
      const p = firstPreviewPose(tools, id);
      if (p != null) return geometry.getBounds(p as TPose);
    }
    const extra = previewExtraRef.current.previewPoseExtra;
    if (extra) {
      const p = extra(id);
      if (p != null) return geometry.getBounds(p as TPose);
    }
    return null;
  }, [tools, geometry]);

  /**
   * Bounds for `id` with any in-flight gesture folded in — what the user can
   * see, not what is committed. Both the chrome state and the layer helpers
   * answer bounds questions with this, so resize handles cannot end up a frame
   * away from the shape they belong to.
   */
  const boundsWithPreview = useCallback((id: string): Bounds | null => {
    const previewed = previewToolBounds(id);
    if (previewed) return previewed;
    return effectiveBoundsOf ? effectiveBoundsOf(id) : null;
  }, [previewToolBounds, effectiveBoundsOf]);

  const chromeState: ChromeState = useMemo(
    () => buildChromeState({
      selection,
      multiActive,
      effectiveBoundsOf: boundsWithPreview,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      // Rotation-capability predicate. Reads the committed pose (gestures
      // don't change descriptor capability) and asks the geometry. Absent
      // adapter / unknown ids fall back to `true` so the affordance stays
      // visible — preserves pre-existing behavior for consumers that wire
      // bounds without an adapter.
      canRotate: (id) => {
        if (!geometry.supportsRotation) return true;
        const pose = committedPoseOf(id);
        if (pose == null) return true;
        return geometry.supportsRotation(pose);
      },
    }),
    [selection, multiActive, boundsWithPreview, geometry, committedPoseOf],
  );

  const helpers: CanvasViewHelpers<TPose> = {
    getEffectivePose: (id: string): TPose | null => {
      const tp = previewToolPose(id);
      if (tp != null) return tp;
      return committedPoseOf(id);
    },
    getEffectiveBounds: boundsWithPreview,
    getGestureBounds: (): Bounds | null => {
      // In-flight ids come from both preview sources the ghost layer walks:
      // tool-published `previewIds()` and the dispatcher's in-flight handles
      // (via `gestureSource.ids()`). Using the same sets keeps this from
      // disagreeing with what the user sees ghosted.
      const ids = aggregatePreviewIds(tools);
      const extraIds = gestureSource?.ids();
      if (extraIds) for (const id of extraIds) ids.add(id);

      const parts: (Bounds | null)[] = [];
      for (const id of ids) parts.push(previewToolBounds(id));
      // Nascent inserts have no id to look up — they arrive as ready-made
      // world AABBs.
      const extraBounds = gestureSource?.bounds();
      if (extraBounds) for (const b of extraBounds) parts.push(b);
      return unionAABB(parts);
    },
    subscribeGestures: (fn: () => void): (() => void) =>
      gestureSource?.subscribe(fn) ?? noOpUnsubscribe,
    getGestureVersion: (): number => gestureSource?.getVersion() ?? 0,
    getChromeState: () => chromeState,
    getPreviewSources: (): readonly GesturePreviewSource[] => [
      ...toolPreviewSources(tools),
      ...(gestureSource?.previewSources() ?? []),
    ],
    getGestureOverlays: (): readonly OngoingOverlay[] => gestureSource?.overlays() ?? [],
    getIsVisible: (): ((id: string) => boolean) => getIsVisible?.() ?? alwaysVisible,
  };

  return {
    helpers,
    chromeState,
    committedPoseOf,
    effectiveBoundsOf,
    previewToolPose,
    previewToolBounds,
    previewExtraRef,
  };
}
