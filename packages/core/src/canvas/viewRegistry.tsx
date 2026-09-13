/**
 * The seam between a canvas surface and the views drawn on it.
 *
 * Traffic runs both ways: the surface attaches a handle onto its frame and its
 * layer stack, and each view registers what it contributes back — the viewport
 * node it paints into and the record the gesture dispatcher routes its events
 * to. Both sides are thunks, read at draw and dispatch time, so neither can
 * serve the other a frame that has already moved.
 */
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { LayerHit } from 'affordances/types';
import type { ChromeState } from 'core/selection/chromeState';
import type { View } from 'core/viewport/view';
import type { ViewportLayer } from 'features/viewports/viewportLayer';
import type { DispatcherViewTarget } from '@weasel-js/routing/react';
import { createViewResolver, type ViewResolver } from 'features/viewports/viewResolver';

/**
 * What a view needs from the surface hosting it.
 *
 * @internal Attached by the surface, read by `<CanvasView>`.
 */
export interface SurfaceHandle {
  /** Client-space origin of the canvas element. */
  origin(): { left: number; top: number };
  /** The outer camera. */
  view(): View;
  /** The canvas's CSS-pixel size. */
  dims(): Dims;
  /** The stack a view paints through its own camera, unless it narrows it. */
  layers(): readonly RenderLayer<unknown>[];
  requestRedraw(): void;
  /** The canvas's own view chrome — its selection, its overlay-aware bounds.
   *  What a `<CanvasView>` answers for itself, answered for view zero. */
  chromeState(): ChromeState;
  /** Hit-test the externally registered layers at a world point, against the
   *  frame and draw envelope of whichever view is asking. The public
   *  `hitTestExtras` is this with the canvas's own frame and envelope. */
  hitTestExtras(
    worldX: number,
    worldY: number,
    view: View,
    dims: Dims,
    data: unknown,
    /** Consider only these layers — the ones the asking view paints. A layer
     *  asked on a frame it was not drawn in answers for the wrong pixels. */
    only?: readonly RenderLayer<unknown>[],
  ): { layerId: string; hit: LayerHit } | null;
  /** Whether a registered layer claims a canvas-local point on the surface's
   *  own frame. Registered layers paint over every view, so such a point is
   *  theirs even inside a view's rect. */
  claimsAbove(x: number, y: number): boolean;
}

/**
 * What one view contributes to the surface hosting it.
 *
 * @internal Written by `<CanvasView>`, read by the surface. Consumers declare
 *   a view, not a registration.
 */
export interface ViewRegistration {
  id: string;
  /**
   * Paint and hit order, low to high. Views declared as props take their array
   * index; a view mounted as a child takes `Infinity`, so it lands after them
   * however React happens to order the mount effects.
   */
  order: number;
  /** The viewport node this view paints into. Its `resolvable` is what routes
   *  input here. */
  layer: ViewportLayer<unknown>;
  /** `false` keeps input over the view on the canvas beneath it. */
  interactive: boolean;
  /** `false` leaves `layer` for a host to draw — a HUD window's interior — so
   *  the surface does not paint it too. */
  paint: boolean;
  /** Everything about dispatching to this view except its id. */
  target: Omit<DispatcherViewTarget, 'id'>;
  /** Whether a scene layer reaches the screen in this view. For input that
   *  reaches a view without a dispatch — hover — so it judges this view's
   *  paint rather than the surface's. */
  layerIsPainted(layerId: string): boolean;
}

/** @internal */
export interface ViewRegistry {
  /** Returns an unregister. */
  register(reg: ViewRegistration): () => void;
  /** Live registrations in paint order. */
  list(): readonly ViewRegistration[];
  /** Bumped whenever the list changes. Pair with {@link ViewRegistry.subscribe}
   *  for `useSyncExternalStore`. */
  getVersion(): number;
  subscribe(fn: () => void): () => void;
  /** Which view a client point belongs to, sticky for a captured pointer.
   *  One per surface: every caller that routes input — the dispatcher, pinch,
   *  hover — must agree about where a point landed. */
  readonly resolver: ViewResolver;
  /** The hosting surface, or `null` before one attaches. */
  surface(): SurfaceHandle | null;
  attachSurface(handle: SurfaceHandle): void;
}

const ViewRegistryContext = createContext<ViewRegistry | null>(null);

/** Mounts the registry for one surface. `<SceneCanvas>` mounts one; a view
 *  declaring itself as a child must be inside it. */
export function ViewRegistryProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef(new Map<ViewRegistration, number>());
  const seqRef = useRef(0);
  const versionRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());
  const surfaceRef = useRef<SurfaceHandle | null>(null);

  const registry = useMemo<ViewRegistry>(() => {
    const changed = (): void => {
      versionRef.current++;
      for (const fn of listenersRef.current) fn();
    };
    const ordered = (): ViewRegistration[] => [...entriesRef.current.keys()].sort((a, b) => (
      a.order - b.order || entriesRef.current.get(a)! - entriesRef.current.get(b)!
    ));
    const resolver = createViewResolver({
      views: () => {
        const surface = surfaceRef.current;
        const view = surface?.view() ?? IDENTITY_VIEW;
        const dims = surface?.dims() ?? UNMEASURED_DIMS;
        return ordered().filter((r) => r.interactive).map((r) => r.layer.resolvable(view, dims));
      },
      root: () => surfaceRef.current?.view() ?? IDENTITY_VIEW,
      canvasOrigin: () => surfaceRef.current?.origin() ?? { left: 0, top: 0 },
      occluded: (x, y) => surfaceRef.current?.claimsAbove(x, y) ?? false,
    });
    return {
      resolver,
      register: (reg) => {
        entriesRef.current.set(reg, seqRef.current++);
        changed();
        return () => { entriesRef.current.delete(reg); changed(); };
      },
      list: ordered,
      getVersion: () => versionRef.current,
      subscribe: (fn) => {
        listenersRef.current.add(fn);
        return () => { listenersRef.current.delete(fn); };
      },
      surface: () => surfaceRef.current,
      attachSurface: (handle) => { surfaceRef.current = handle; },
    };
  }, []);

  return <ViewRegistryContext.Provider value={registry}>{children}</ViewRegistryContext.Provider>;
}

/** The surface's view registry, or `null` outside one. */
export function useOptionalViewRegistry(): ViewRegistry | null {
  return useContext(ViewRegistryContext);
}

/** The `Dims` a surface reports before it has measured itself. */
export const UNMEASURED_DIMS: Dims = { width: 0, height: 0 };

/** The camera a view resolves against before its surface attaches. */
export const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
