/** What a press inside a `<CanvasView>` lands on: its chrome affordance, and the node it targets. */
import { useMemo } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { useLatest } from '@weasel-js/react';
import { useDeviceProfile } from 'core/device/useDeviceProfile';
import type { DepRegistry, SelectionApi } from '@weasel-js/routing';
import { anchorStateFrom, buildAffordanceAt, buildClassifyTarget, layerAffordance } from './affordanceAt';
import { pathFromPlane } from './planeClips';
import type { SurfaceViewInputs } from './viewInputs';
import type { ViewRect } from './canvasViewProps';
import type { CanvasViewHelpers } from './useViewHelpers';
import type { ViewRegistry } from './viewRegistry';

export interface ViewPickingInputs {
  id: string;
  registry: ViewRegistry | null;
  inputs: SurfaceViewInputs | null;
  camera: () => View;
  rectNow: () => ViewRect;
  drawnLayers: () => readonly RenderLayer<unknown>[];
  layerIsPainted: (layerId: string) => boolean;
  selectionNow: () => SelectionApi;
  helpersRef: { readonly current: CanvasViewHelpers<unknown> };
  depRegistryRef: { readonly current: DepRegistry | null };
}

/** This view's hit-testing: the surface's construction, against this view's chrome, camera and layer gate. */
export function useViewPicking({
  id, registry, inputs, camera, rectNow, drawnLayers, layerIsPainted, selectionNow, helpersRef, depRegistryRef,
}: ViewPickingInputs) {
  const inputsRef = useLatest(inputs);
  const rotationBadge = inputs?.rotationBadge ?? null;

  // Anchors are hit in this view's camera world, where its plane draws them.
  const getAnchorState = useMemo(() => anchorStateFrom(
    () => depRegistryRef.current,
    (id, path) => pathFromPlane(path, inputsRef.current?.planeOfNode?.(id, camera()) ?? null),
  ), [camera, depRegistryRef, inputsRef]);

  const { targetScale } = useDeviceProfile();

  const affordanceAt = useMemo(() => {
    const inner = buildAffordanceAt({
      getChromeState: () => helpersRef.current.getChromeState(),
      getView: camera,
      targetScale,
      rotationBadge, handleHitRadius: inputs?.resizeHandles?.hitRadiusPx, edgeHandles: inputs?.resizeHandles?.edges, selectionChrome: inputs?.selectionChrome,
      getAnchorState,
      getIsVisible: () => helpersRef.current.getIsVisible(),
    });
    return (world: { x: number; y: number }) => {
      // A registered layer this view paints gets first refusal, on this
      // view's frame and envelope. One painted over the surface already had
      // its chance: it occludes the view before routing reaches here.
      const extra = registry?.surface()?.hitTestExtras(
        world.x, world.y, camera(), rectNow(), helpersRef.current, drawnLayers(),
      );
      return extra ? layerAffordance(extra.layerId, extra.hit) : registry?.markerAt(id, world) ?? inner(world);
    };
  }, [id, getAnchorState, rectNow, registry, targetScale, camera, drawnLayers, rotationBadge, inputs?.resizeHandles, inputs?.selectionChrome, helpersRef]);

  const classifyTarget = useMemo(() => buildClassifyTarget(
    () => selectionNow().get(),
    (world) => {
      const i = inputsRef.current;
      // This view's camera: the dispatcher converted with `clientToWorldHere`,
      // and a screen-pixel tolerance needs the scale that produced it. The
      // layer gate is this view's too, never the surface's.
      const frame = { ...camera(), layerIsPainted, viewId: id };
      if (i?.pickBest) return i.pickBest(world, frame);
      const ids = i?.pickEvery?.(world, frame) ?? [];
      return ids.length > 0 ? ids[ids.length - 1]! : null;
    },
    (id) => inputsRef.current?.kindOfNode?.(id),
    (id) => inputsRef.current?.doubleClickNames?.(id) ?? id,
  ), [id, camera, layerIsPainted, selectionNow, inputsRef]);

  return { affordanceAt, classifyTarget };
}
