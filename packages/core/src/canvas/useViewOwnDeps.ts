/** The deps a `<CanvasView>` answers itself rather than passing the surface's through: `view` and `ingestion`. */
import { useMemo } from 'react';
import type { View } from 'core/viewport/view';
import { useViewAnimation } from 'core/viewport/useViewAnimation';
import { useDecayLoop } from 'core/viewport/useDecayLoop';
import { useViewDepSource } from './deps/view';
import type { DepRegistry } from '@weasel-js/routing';
import type { IngestionDep, ViewApi } from 'interactions/actions/depSchema';
import { viewportWorldRect, worldPerPxOf } from 'core/viewport/viewportWorldRect';
import type { ViewRect } from './canvasViewProps';

export function useViewOwnDeps(
  camera: () => View,
  setViewFromInput: ViewApi['set'],
  rectNow: () => ViewRect,
  layerIsPainted: (layerId: string) => boolean,
  depRegistryRef: { readonly current: DepRegistry | null },
): { viewApi: ViewApi; ingestionApi: IngestionDep } {
  const channel = useMemo(() => ({ get: camera, set: setViewFromInput }), [camera, setViewFromInput]);
  const cameraRef = useMemo(() => ({ get current() { return camera(); } }), [camera]);
  // Fit Content fits what the scene draws, read off the surface's own view dep. Its `recenter` is left
  // behind: that is the root camera's home, and a consumer's may move the root itself.
  const contentBounds = useMemo(() => () => depRegistryRef.current?.get('rootView')?.contentBounds?.() ?? null, [depRegistryRef]);
  const viewApi = useViewDepSource(
    cameraRef, setViewFromInput, undefined, rectNow, useViewAnimation(channel), useDecayLoop(), layerIsPainted, contentBounds,
  );

  // Paste placement is a camera question, so it is this view's when the paste
  // routed here. The rest of the dep — `resolveSrc`, `svg`, `clipboard`, `handlers` — is
  // the surface's one wiring, read live off the canvas registry.
  const ingestionApi = useMemo<IngestionDep>(() => {
    const base = (): IngestionDep | undefined => depRegistryRef.current?.get('ingestion');
    return {
      viewportWorldRect: () => viewportWorldRect(camera(), rectNow()),
      worldPerPx: () => worldPerPxOf(camera()),
      get resolveSrc() { return base()?.resolveSrc; },
      get svg() { return base()?.svg; },
      get clipboard() { return base()?.clipboard; }, get handlers() { return base()?.handlers; },
    };
  }, [camera, rectNow, depRegistryRef]);

  return { viewApi, ingestionApi };
}
