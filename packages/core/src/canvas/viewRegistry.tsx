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
import type { DispatcherViewTarget } from '@weasel-js/routing/internal';
import { createViewResolver, viewContains, type ViewResolver } from 'features/viewports/viewResolver';
import { createEmitter } from '@weasel-js/registry';
import type { ViewAt } from './canvasExtension';
import { isRectAim, rectAim, viewForAim, type ViewAim } from 'features/viewports/aim';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import type { ViewMarkerProps } from 'features/viewports/viewMarker';
import { createViewMarkerRegistry, type ViewMarkerRegistry } from './viewMarkers';

/**
 * What a view needs from the surface hosting it.
 *
 * @internal Attached by the surface, read by `<CanvasView>`.
 */
export interface SurfaceHandle {
  /** A client point in the surface's own world — the conversion the surface
   *  itself makes, its `clientToWorld` override included. */
  clientToWorld(clientX: number, clientY: number): [number, number];
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
  /** The root camera's input write: clamped, forwarded when controlled, and ending a glide. */
  setView?(next: View): void;
}

/**
 * A client point in the surface's CSS pixels, from its top-left: the surface's
 * own world point put back through its camera, so a `clientToWorld` override
 * reaches every view declared on it.
 *
 * @internal
 */
export function surfaceLocal(
  surface: Pick<SurfaceHandle, 'clientToWorld' | 'view'> | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (!surface) return { x: clientX, y: clientY };
  const [worldX, worldY] = surface.clientToWorld(clientX, clientY);
  const view = surface.view();
  return { x: (worldX - view.x) * view.scale.x, y: (worldY - view.y) * view.scale.y };
}

/**
 * What one view contributes to the surface hosting it.
 *
 * @internal Written by `<CanvasView>`, read by the surface. Consumers declare
 *   a view, not a registration.
 */
export interface ViewRegistration {
  id: string;
  /** The view this one is nested in: listed, painted and hit after it, and
   *  its `layer` measures itself from that view's rect and camera. */
  parent?: string;
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
  /** The layers this view draws, in order — what a view nested in it paints
   *  from. */
  drawnLayers(): readonly RenderLayer<unknown>[];
  /** Whether the view keeps its camera or its aim; the other is derived. */
  held: 'camera' | 'aim';
  /** What the view shows: the aim it holds, or its camera's. */
  aim(): ViewAim;
  /** `false` for an aim the view cannot read, or one with nowhere to go. */
  setAim(aim: ViewAim): boolean;
}


/** @internal */
export interface ViewRegistry extends ViewMarkerRegistry {
  /** Returns an unregister. */
  register(reg: ViewRegistration): () => void;
  /** Live registrations in paint order, each nested view after the view it
   *  is nested in. */
  list(): readonly ViewRegistration[];
  /** The live registration with `id`, if any. */
  get(id: string): ViewRegistration | undefined;
  /** The innermost view painted under a canvas-local point, whether or not it
   *  takes input, passing over `except` and the views nested in it. */
  viewAt(at: { x: number; y: number }, opts?: { except?: string }): ViewAt;
  /** What view `id` shows (`null`: the surface's root), or `null` while there is no such view. */
  aimOf(id: string | null): ViewAim | null;
  /** Point view `id` at `aim`; `false` when it cannot. */
  setAim(id: string | null, aim: ViewAim): boolean;
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
  /** Returns a detach, which leaves a handle attached since alone. */
  attachSurface(handle: SurfaceHandle): () => void;
}

const ViewRegistryContext = createContext<ViewRegistry | null>(null);

/** Mounts the registry for one surface. `<SceneCanvas>` mounts one; a view
 *  declaring itself as a child must be inside it. */
export function ViewRegistryProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef(new Map<ViewRegistration, number>());
  const seqRef = useRef(0);
  const versionRef = useRef(0);
  const surfaceRef = useRef<SurfaceHandle | null>(null);
  const markersRef = useRef(new Map<() => ViewMarkerProps, RenderLayer<unknown>>());

  const registry = useMemo<ViewRegistry>(() => {
    const listeners = createEmitter();
    const changed = (): void => {
      versionRef.current++;
      listeners.emit();
    };
    const ordered = (): ViewRegistration[] => nestedOrder([...entriesRef.current.keys()].sort((a, b) => (
      a.order - b.order || entriesRef.current.get(a)! - entriesRef.current.get(b)!
    )));
    const get = (id: string): ViewRegistration | undefined => {
      for (const r of entriesRef.current.keys()) if (r.id === id) return r;
      return undefined;
    };
    /** Whether `r` is `id` or nested in it, however deep. */
    const within = (r: ViewRegistration, id: string): boolean => {
      const seen = new Set<ViewRegistration>();
      for (let at: ViewRegistration | undefined = r; at && !seen.has(at); at = at.parent === undefined ? undefined : get(at.parent)) {
        if (at.id === id) return true;
        seen.add(at);
      }
      return false;
    };
    const resolver = createViewResolver({
      views: () => {
        const surface = surfaceRef.current;
        const view = surface?.view() ?? IDENTITY_VIEW;
        const dims = surface?.dims() ?? UNMEASURED_DIMS;
        return ordered().filter((r) => r.interactive).map((r) => r.layer.resolvable(view, dims));
      },
      root: () => surfaceRef.current?.view() ?? IDENTITY_VIEW,
      toLocal: (clientX, clientY) => surfaceLocal(surfaceRef.current, clientX, clientY),
      occluded: (x, y) => surfaceRef.current?.claimsAbove(x, y) ?? false,
    });
    const registry: ViewRegistry = {
      resolver,
      register: (reg) => {
        entriesRef.current.set(reg, seqRef.current++);
        changed();
        return () => { entriesRef.current.delete(reg); changed(); };
      },
      list: ordered,
      get,
      viewAt: ({ x, y }, opts) => {
        const surface = surfaceRef.current;
        const view = surface?.view() ?? IDENTITY_VIEW;
        const dims = surface?.dims() ?? UNMEASURED_DIMS;
        const except = opts?.except;
        const list = ordered();
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i]!;
          if (except !== undefined && within(r, except)) continue;
          const v = r.layer.resolvable(view, dims);
          if (viewContains(v, x, y)) return { id: v.id, view: v.view, rect: v.rect };
        }
        return { id: null, view, rect: { x: 0, y: 0, w: dims.width, h: dims.height } };
      },
      aimOf: (id) => {
        if (id !== null) return get(id)?.aim() ?? null;
        const surface = surfaceRef.current;
        return surface ? rectAim(null, viewportWorldRect(surface.view(), surface.dims())) : null;
      },
      setAim: (id, aim) => {
        if (id !== null) return get(id)?.setAim(aim) ?? false;
        const surface = surfaceRef.current;
        if (!isRectAim(aim) || !surface?.setView) return false;
        surface.setView(viewForAim(aim.extent, surface.dims(), 'exact'));
        return true;
      },
      ...createViewMarkerRegistry(markersRef.current, {
        host: { aimOf: (id) => registry.aimOf(id), setAim: (id, aim) => registry.setAim(id, aim) },
        surface: () => surfaceRef.current,
        resolve: (id, outer, dims) => get(id)?.layer.resolvable(outer, dims),
        changed,
      }),
      getVersion: () => versionRef.current,
      subscribe: listeners.subscribe,
      surface: () => surfaceRef.current,
      attachSurface: (handle) => {
        surfaceRef.current = handle;
        return () => { if (surfaceRef.current === handle) surfaceRef.current = null; };
      },
    };
    return registry;
  }, []);

  return <ViewRegistryContext.Provider value={registry}>{children}</ViewRegistryContext.Provider>;
}

/** The surface's view registry, or `null` outside one. */
export function useOptionalViewRegistry(): ViewRegistry | null {
  return useContext(ViewRegistryContext);
}

/** Each view followed by the views nested in it, in the order given. A view
 *  whose parent is not registered keeps its place; one caught in a cycle
 *  goes last. */
function nestedOrder(sorted: readonly ViewRegistration[]): ViewRegistration[] {
  const ids = new Set(sorted.map((r) => r.id));
  const out: ViewRegistration[] = [];
  const placed = new Set<ViewRegistration>();
  const place = (r: ViewRegistration): void => {
    if (placed.has(r)) return;
    placed.add(r);
    out.push(r);
    for (const child of sorted) if (child.parent === r.id) place(child);
  };
  for (const r of sorted) if (r.parent === undefined || !ids.has(r.parent)) place(r);
  for (const r of sorted) place(r);
  return out;
}

/** The `Dims` a surface reports before it has measured itself. */
export const UNMEASURED_DIMS: Dims = { width: 0, height: 0 };

/** The camera a view resolves against before its surface attaches. */
export const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
