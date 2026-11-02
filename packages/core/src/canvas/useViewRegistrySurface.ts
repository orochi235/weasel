import { useEffect } from 'react';
import { useLatest } from '@weasel-js/react';
import { viewScreenToWorld } from '@weasel-js/geom';
import type { View } from 'core/viewport/view';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { CanvasHelpers } from './useViewHelpers';
import type { SurfaceHandle, ViewRegistry } from './viewRegistry';

/** What the canvas reads at draw and hit time that changes outside a render. */
export interface SurfaceFrame {
  viewRef: { readonly current: View };
  dimsRef: { readonly current: Dims };
  helpersRef: { readonly current: Pick<CanvasHelpers<unknown>, 'getChromeState'> | null };
}

/** What the canvas does for a view that asks. */
export interface SurfaceServices {
  requestRedraw: () => void;
  hitTestExtrasIn: SurfaceHandle['hitTestExtras'];
  clientToWorld: SurfaceHandle['clientToWorld'];
  setView: NonNullable<SurfaceHandle['setView']>;
}

/**
 * Attach this canvas to the view registry as its surface. The stack a view paints through its
 * own camera is this canvas's `layers`, before the views themselves are folded in — otherwise
 * a view would contain itself. Published by reference and read at draw time.
 */
export function useViewRegistrySurface(
  viewRegistry: ViewRegistry | null,
  layers: readonly RenderLayer<unknown>[],
  frame: SurfaceFrame,
  services: SurfaceServices,
): void {
  const surfaceLayersRef = useLatest<readonly RenderLayer<unknown>[]>(layers);
  const { viewRef, dimsRef, helpersRef } = frame;
  const { requestRedraw, hitTestExtrasIn, clientToWorld, setView } = services;
  useEffect(() => {
    return viewRegistry?.attachSurface({
      view: () => viewRef.current,
      dims: () => dimsRef.current,
      layers: () => surfaceLayersRef.current,
      requestRedraw,
      chromeState: () => helpersRef.current!.getChromeState(),
      hitTestExtras: hitTestExtrasIn,
      clientToWorld,
      setView,
      claimsAbove: (x, y) => {
        const view = viewRef.current;
        const world = viewScreenToWorld(view, { x, y });
        return hitTestExtrasIn(world.x, world.y, view, dimsRef.current, helpersRef.current) !== null;
      },
    });
  }, [viewRegistry, requestRedraw, hitTestExtrasIn, dimsRef, surfaceLayersRef, viewRef, helpersRef, clientToWorld, setView]);
}
