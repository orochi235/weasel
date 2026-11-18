/** The deps a `<CanvasView>` answers itself rather than passing the surface's through: `view` and `ingestion`. */
import { useMemo } from 'react';
import type { View } from 'core/viewport/view';
import type { DepRegistry } from '@weasel-js/routing';
import type { IngestionDep, ViewApi } from 'interactions/actions/depSchema';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import type { ViewRect } from './canvasViewProps';

export function useViewOwnDeps(
  camera: () => View,
  setViewFromInput: ViewApi['set'],
  rectNow: () => ViewRect,
  layerIsPainted: (layerId: string) => boolean,
  depRegistryRef: { readonly current: DepRegistry | null },
): { viewApi: ViewApi; ingestionApi: IngestionDep } {
  const viewApi = useMemo<ViewApi>(() => ({
    get: camera,
    set: setViewFromInput,
    hostSize: () => rectNow(),
    layerIsPainted,
  }), [camera, rectNow, setViewFromInput, layerIsPainted]);

  // Paste placement is a camera question, so it is this view's when the paste
  // routed here. The rest of the dep — `resolveSrc`, `svg`, `clipboard`, `handlers` — is
  // the surface's one wiring, read live off the canvas registry.
  const ingestionApi = useMemo<IngestionDep>(() => {
    const base = (): IngestionDep | undefined => depRegistryRef.current?.get('ingestion');
    return {
      viewportWorldRect: () => viewportWorldRect(camera(), rectNow()),
      get resolveSrc() { return base()?.resolveSrc; },
      get svg() { return base()?.svg; },
      get clipboard() { return base()?.clipboard; }, get handlers() { return base()?.handlers; },
    };
  }, [camera, rectNow, depRegistryRef]);

  return { viewApi, ingestionApi };
}
