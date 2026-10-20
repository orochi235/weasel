import { useCallback, useMemo, useRef } from 'react';
import { framedBounds } from 'core/geometry/poseDescriptor';
import { useLatest } from '@weasel-js/react';
import type { GestureSource, GesturePreviewSource } from './gestureBounds';
import type { OngoingOverlay } from '@weasel-js/routing';
import { unionAABB } from 'core/geometry/unionBounds';
import { buildChromeState, type ChromeState } from 'core/selection/chromeState';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { NodeId } from 'core/scene/types';
import type { DebugSink } from '../debug/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { Scale2 } from '@weasel-js/geom';
import { drawnBoundsOf, type DrawnBoundsScene } from './drawnBounds';

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
   * gesture isn't touching is excluded. Select-only gestures are excluded
   * too: a marquee or lasso has geometry but proposes no content.
   *
   * The result is a plain AABB — never rotated. Rotated parts are folded in
   * by their rotated extent.
   */
  getGestureBounds(): Bounds | null;
  /**
   * Subscribe to the gesture layer's change signal, for everything on this
   * object that moves during a drag (`getEffectivePose`, `getEffectiveBounds`,
   * `getGestureBounds`). Returns an unsubscribe.
   *
   * Fires once per dispatcher pump: gesture start, every pointermove that
   * reaches an in-flight handle, end, and cancel — plus UI-driven ongoing
   * actions. It fires on the pump, not on a diff: a pump that changed nothing
   * observable still notifies, so don't hang expensive work directly off the
   * callback.
   *
   * It does **not** cover committed scene edits (subscribe to the scene for
   * those) or previews a consumer's own tool publishes from React state.
   * Without a gesture source wired — a bare `<Canvas>` — it never fires.
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
  /** The live ChromeState built once per render: overlay-aware selection
   *  state for affordances and custom layers. */
  getChromeState(): ChromeState;
  /**
   * Everything publishing an in-flight preview for this view: the handles in
   * flight on its dispatcher, in dispatch order. Readers take the first
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
   * Unwired, it is the universal `() => true`.
   */
  getIsVisible(): (id: string) => boolean;
}

/**
 * The half of {@link CanvasHelpers} that belongs to the surface — one GL
 * context, one debug sink, however many views are drawn on it.
 */
export interface CanvasSurfaceHelpers {
  /** Active debug sink, when `<Canvas debug=...>` is enabled, for layers to
   *  call from their `draw` callback. `null` when debug is off. */
  getDebug(): DebugSink | null;
}

/** Live overlay-aware lookups exposed to custom layers via `helpersRef`, and
 *  what a layer receives as its `data` argument. */
export interface CanvasHelpers<TPose> extends CanvasViewHelpers<TPose>, CanvasSurfaceHelpers {
  /**
   * The view this draw is for: a `<CanvasView>` id, or `null` for the
   * surface's own camera. One layer array paints every view, so a layer that
   * belongs in some views and not others — a minimap's indicator — declines
   * the rest by this id.
   */
  readonly viewId: string | null;
}

/** What a view's pose and bounds lookups read of an adapter. */
export interface ViewPoseAdapter<TPose> {
  getPose(id: string): TPose;
  /** Where the node is drawn, when the adapter composes poses. An adapter
   *  without it stores absolute poses, where the two agree. */
  getWorldPose?(id: string): TPose;
  /** The node an id names, whose `layer` decides whether a view that hides
   *  that layer shows its selection chrome. */
  getNode?(id: string): { layer?: string } | undefined;
}

export interface UseViewHelpersOpts<TPose> {
  adapter: ViewPoseAdapter<TPose> | undefined;
  geometry: PoseDescriptor<TPose>;
  /** Consumer-supplied bounds resolver. Falls back to the adapter's pose. */
  boundsOf: ((id: string) => Bounds | null) | undefined;
  /** Bounds of `id` drawn at an in-flight `pose`. Falls back to the
   *  geometry's box of that pose, which is wrong wherever the surface draws a
   *  node somewhere its pose does not say — a parallax plane. */
  boundsOfPose?: ((id: string, pose: TPose) => Bounds | null) | undefined;
  /** The nodes the adapter's ids name: with them, the fallbacks box each as
   *  drawn, stroke included, rather than by its pose. */
  nodes?: DrawnBoundsScene | undefined;
  /** The view's scale, which a screen-pixel stroke is resolved at. Default 1. */
  getScale?: (() => Scale2) | undefined;
  selection: readonly NodeId[];
  gestureSource: GestureSource | undefined;
  /** The dispatcher's preview pose for an id, read through a ref so a change
   *  mid-gesture doesn't rebuild the memos that depend on it. */
  previewPoseExtra: ((id: string) => unknown) | undefined;
  /** Chrome-caps predicate for this view. Absent means everything is visible. */
  getIsVisible?: (() => (id: string) => boolean) | undefined;
  /** Whether a scene layer reaches the screen in this view. Absent means
   *  every layer the scene shows does. */
  layerIsPainted?: ((layerId: string) => boolean) | undefined;
}

export interface ViewHelpersBundle<TPose> {
  helpers: CanvasViewHelpers<TPose>;
}

function worldPoseOf<TPose>(adapter: ViewPoseAdapter<TPose>, id: string): TPose {
  return typeof adapter.getWorldPose === 'function' ? adapter.getWorldPose(id) : adapter.getPose(id);
}

/**
 * Build one view's overlay-aware state: its chrome and the lookups its layers
 * draw and hit-test against. A canvas with N views mounts N components each
 * calling this once.
 */
export function useViewHelpers<TPose>(
  opts: UseViewHelpersOpts<TPose>,
): ViewHelpersBundle<TPose> {
  const {
    adapter, geometry, boundsOf, boundsOfPose, nodes, getScale, selection, gestureSource,
    previewPoseExtra, getIsVisible, layerIsPainted,
  } = opts;
  const getScaleRef = useLatest(getScale);
  const poseBoxOf = useCallback((id: string, pose: TPose): Bounds => {
    if (!nodes) return framedBounds(pose, geometry);
    const scale = getScaleRef.current?.();
    return drawnBoundsOf(nodes, id as NodeId, pose, {
      descriptor: geometry as PoseDescriptor<unknown>,
      ...(adapter ? { worldPoseOf: (m: NodeId) => worldPoseOf(adapter, m) } : {}),
      ...(scale ? { scale } : {}),
    });
  }, [nodes, geometry, adapter, getScaleRef]);
  const boxOf = useCallback(
    (id: string, pose: TPose): Bounds | null =>
      (boundsOfPose ? boundsOfPose(id, pose) : poseBoxOf(id, pose)),
    [boundsOfPose, poseBoxOf],
  );

  const baseBoundsOf = useMemo(() => {
    if (boundsOf) return boundsOf;
    if (!adapter) return undefined;
    return (id: string): Bounds | null => {
      try {
        // World: chrome is drawn over the picture, so it has to agree with
        // where the renderer put the node, not with where its pose is stored.
        return poseBoxOf(id, worldPoseOf(adapter, id));
      } catch {
        return null;
      }
    };
  }, [boundsOf, adapter, poseBoxOf]);

  const committedPoseOf = useCallback((id: string): TPose | null => {
    if (!adapter) return null;
    try {
      return worldPoseOf(adapter, id);
    } catch {
      return null;
    }
  }, [adapter]);

  const multiActive = selection.length > 1;

  const previewPoseExtraRef = useLatest(previewPoseExtra);

  const effectiveBoundsOf = useMemo(() => boundsOf ?? baseBoundsOf, [boundsOf, baseBoundsOf]);

  const previewPoseOf = useCallback((id: string): TPose | null => {
    const p = previewPoseExtraRef.current?.(id);
    return p != null ? (p as TPose) : null;
  }, [previewPoseExtraRef]);
  // A gesture source's ids, re-read only when its version moves.
  const inFlight = useRef<{ source: GestureSource; version: number; ids: ReadonlySet<string> } | null>(null);
  const isInFlight = useCallback((id: string): boolean => {
    if (!gestureSource) return false;
    const version = gestureSource.getVersion();
    let entry = inFlight.current;
    if (entry === null || entry.source !== gestureSource || entry.version !== version) {
      entry = { source: gestureSource, version, ids: new Set(gestureSource.ids() ?? []) };
      inFlight.current = entry;
    }
    return entry.ids.has(id);
  }, [gestureSource]);

  /** Bounds of an in-flight `id`: at the pose a source previews, else at its
   *  effective pose — a transform's poses live in the scene's overrides.
   *  Boxed through `boxOf` either way, since a consumer `boundsOf` answers
   *  for the document pose only. */
  const previewBoundsOf = useCallback((id: string): Bounds | null => {
    const p = previewPoseOf(id);
    if (p != null) return boxOf(id, p);
    if (!isInFlight(id)) return null;
    const shown = committedPoseOf(id);
    return shown != null ? boxOf(id, shown) : null;
  }, [previewPoseOf, boxOf, isInFlight, committedPoseOf]);

  /**
   * Bounds for `id` with any in-flight gesture folded in — what the user can
   * see, not what is committed. Both the chrome state and the layer helpers
   * answer bounds questions with this, so resize handles cannot end up a frame
   * away from the shape they belong to.
   */
  const boundsWithPreview = useCallback((id: string): Bounds | null => {
    const previewed = previewBoundsOf(id);
    if (previewed) return previewed;
    return effectiveBoundsOf ? effectiveBoundsOf(id) : null;
  }, [previewBoundsOf, effectiveBoundsOf]);

  const chromeState: ChromeState = useMemo(
    () => buildChromeState({
      selection,
      multiActive,
      effectiveBoundsOf: boundsWithPreview,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      // Absent adapter / unknown ids fall back to `true` so the affordance
      // stays visible for consumers that wire bounds without an adapter.
      canRotate: (id) => {
        if (!geometry.supportsRotation) return true;
        const pose = committedPoseOf(id);
        if (pose == null) return true;
        return geometry.supportsRotation(pose);
      },
      ...(layerIsPainted ? { layerIsPainted } : {}),
      ...(adapter?.getNode ? { layerOf: (id: string) => adapter.getNode?.(id)?.layer } : {}),
    }),
    [selection, multiActive, boundsWithPreview, geometry, committedPoseOf, layerIsPainted, adapter],
  );

  const helpers: CanvasViewHelpers<TPose> = {
    getEffectivePose: (id: string): TPose | null => {
      return previewPoseOf(id) ?? committedPoseOf(id);
    },
    getEffectiveBounds: boundsWithPreview,
    getGestureBounds: (): Bounds | null => {
      // The same id sets the ghost layer walks, so this cannot disagree with
      // what the user sees ghosted.
      const parts: (Bounds | null)[] = [];
      for (const id of new Set(gestureSource?.ids() ?? [])) parts.push(previewBoundsOf(id));
      const extraBounds = gestureSource?.bounds();
      if (extraBounds) for (const b of extraBounds) parts.push(b);
      return unionAABB(parts);
    },
    subscribeGestures: (fn: () => void): (() => void) =>
      gestureSource?.subscribe(fn) ?? noOpUnsubscribe,
    getGestureVersion: (): number => gestureSource?.getVersion() ?? 0,
    getChromeState: () => chromeState,
    getPreviewSources: (): readonly GesturePreviewSource[] => gestureSource?.previewSources() ?? [],
    getGestureOverlays: (): readonly OngoingOverlay[] => gestureSource?.overlays() ?? [],
    getIsVisible: (): ((id: string) => boolean) => getIsVisible?.() ?? alwaysVisible,
  };

  return { helpers };
}
