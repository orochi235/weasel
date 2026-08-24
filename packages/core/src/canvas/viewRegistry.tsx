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
import type { View } from 'core/viewport/view';
import type { ViewportLayer } from 'features/viewports/viewportLayer';
import type { DispatcherViewTarget } from 'interactions/dispatcher/useGestureDispatcher';

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
  /** Hit-test the externally registered layers at a world point, against the
   *  frame and draw envelope of whichever view is asking. The public
   *  `hitTestExtras` is this with the canvas's own frame and envelope. */
  hitTestExtras(
    worldX: number,
    worldY: number,
    view: View,
    dims: Dims,
    data: unknown,
  ): { layerId: string; hit: LayerHit } | null;
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
  /** Everything about dispatching to this view except its id. */
  target: Omit<DispatcherViewTarget, 'id'>;
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
    return {
      register: (reg) => {
        entriesRef.current.set(reg, seqRef.current++);
        changed();
        return () => { entriesRef.current.delete(reg); changed(); };
      },
      list: () => [...entriesRef.current.keys()].sort((a, b) => (
        a.order - b.order || entriesRef.current.get(a)! - entriesRef.current.get(b)!
      )),
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
