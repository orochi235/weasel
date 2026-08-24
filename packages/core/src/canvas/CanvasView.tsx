/**
 * `<CanvasView>` — a second view on an existing canvas: its own camera over a
 * rect of the surface, with input routed to it.
 *
 * Mount one inside `<SceneCanvas>`, or declare the same thing through the
 * surface's `views` prop, which renders one of these per descriptor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';
import { clampView } from 'core/viewport/clampView';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { createViewportLayer } from 'features/viewports/viewportLayer';
import { createDispatcher } from 'interactions/dispatcher/dispatcher';
import type { ViewApi } from 'interactions/actions/depSchema';
import {
  useOptionalViewRegistry,
  IDENTITY_VIEW,
  UNMEASURED_DIMS,
  type ViewRegistration,
} from './viewRegistry';

/** A rect on the surface, in CSS pixels from the canvas top-left. */
export interface ViewRect { x: number; y: number; w: number; h: number }

/** Props for `<CanvasView>`. @experimental */
export interface CanvasViewProps {
  /** Identifies the view to the surface and to input routing. Must be unique
   *  among the views on one canvas. */
  id: string;
  /** Where this view paints, recomputed every frame so the rect can track the
   *  outer camera. A plain rect is accepted for a fixed panel. */
  bounds: ViewRect | ((outer: View, dims: Dims) => ViewRect);
  /** Camera. Supply this to control it; otherwise the view keeps its own,
   *  seeded from `defaultView`. `onViewChange` fires either way. */
  view?: View;
  defaultView?: View;
  onViewChange?: (v: View) => void;
  /** Pan limits, applied to every camera change the same way `<Canvas>`
   *  applies its own. */
  viewBounds?: Bounds;
  /** Which of the surface's layers this view paints. Defaults to all of them —
   *  the same content through a second camera. */
  layers?: (surface: readonly RenderLayer<unknown>[]) => readonly RenderLayer<unknown>[];
  /** Opaque ground painted before the source layers, so the surface does not
   *  show through where the inner camera sees nothing. */
  background?: string;
  /** Paint and hit order. Defaults to `Infinity` — after every view the
   *  surface declared as a prop. */
  order?: number;
  /** Label for debug overlays. Defaults to the id. */
  label?: string;
}

const ALL_LAYERS = (s: readonly RenderLayer<unknown>[]): readonly RenderLayer<unknown>[] => s;

/**
 * @experimental
 *
 * One view on a shared canvas. Owns a camera, contributes the viewport node
 * that paints it, and registers the dispatch record that sends gestures inside
 * its rect to that camera rather than to the canvas's.
 *
 * Renders nothing itself — it is a declaration, and the surface does the
 * drawing. Outside a surface that mounts a view registry it is inert.
 */
export function CanvasView(props: CanvasViewProps): null {
  const {
    id, bounds, view: viewProp, defaultView, onViewChange, viewBounds,
    layers = ALL_LAYERS, background, order = Infinity, label,
  } = props;

  const registry = useOptionalViewRegistry();

  const [internalView, setInternalView] = useState<View>(defaultView ?? IDENTITY_VIEW);
  const effectiveView = viewProp ?? internalView;

  // Everything the registration reads is behind a ref: the registration object
  // is registered once and must not churn, but what it answers with has to be
  // this render's.
  const live = useRef({ view: effectiveView, bounds, layers, onViewChange, viewBounds, viewProp });
  live.current = { view: effectiveView, bounds, layers, onViewChange, viewBounds, viewProp };

  const rectAt = useCallback((outer: View, dims: Dims): ViewRect => {
    const b = live.current.bounds;
    return typeof b === 'function' ? b(outer, dims) : b;
  }, []);

  /** The rect for the surface's current frame — what a client point and a
   *  clamp are measured against outside a draw call. */
  const rectNow = useCallback((): ViewRect => {
    const surface = registry?.surface();
    return rectAt(surface?.view() ?? IDENTITY_VIEW, surface?.dims() ?? UNMEASURED_DIMS);
  }, [registry, rectAt]);

  const setView = useCallback((next: View) => {
    const { viewBounds: vb, onViewChange: cb, viewProp: controlled } = live.current;
    const rect = rectNow();
    const clamped = vb ? clampView(next, vb, { width: rect.w, height: rect.h }) : next;
    if (controlled === undefined) setInternalView(clamped);
    cb?.(clamped);
    registry?.surface()?.requestRedraw();
  }, [registry, rectNow]);

  const viewApi = useMemo<ViewApi>(() => ({
    get: () => live.current.view,
    set: setView,
    hostSize: () => {
      const rect = rectNow();
      return { width: rect.w, height: rect.h };
    },
  }), [rectNow, setView]);

  // One dispatcher per view: in-flight handles are per-view state, and two
  // views must not be able to see each other's.
  const dispatcherRef = useRef<ReturnType<typeof createDispatcher> | null>(null);
  if (!dispatcherRef.current) dispatcherRef.current = createDispatcher();

  const registration = useMemo<ViewRegistration>(() => ({
    id,
    order,
    layer: createViewportLayer<unknown, unknown>({
      id,
      label: label ?? id,
      source: () => live.current.layers(registry?.surface()?.layers() ?? []),
      view: () => live.current.view,
      bounds: (outer, dims) => rectAt(outer, dims),
      ...(background !== undefined ? { background } : {}),
    }),
    target: {
      dispatcher: dispatcherRef.current!,
      affordanceAt: undefined,
      classifyTarget: undefined,
      clientToWorld: (cx, cy) => {
        const canvas = registry?.surface()?.origin() ?? { left: 0, top: 0 };
        const rect = rectNow();
        const [x, y] = clientToWorld(
          cx, cy,
          { left: canvas.left + rect.x, top: canvas.top + rect.y },
          live.current.view,
        );
        return { x, y };
      },
      deps: () => ({ view: viewApi }),
    },
  }), [id, order, label, background, registry, rectAt, rectNow, viewApi]);

  useEffect(() => {
    if (!registry) return;
    return registry.register(registration);
  }, [registry, registration]);

  // A camera change is invisible until the surface repaints, and nothing else
  // observes this component's state.
  useEffect(() => {
    registry?.surface()?.requestRedraw();
  }, [registry, effectiveView]);

  return null;
}
