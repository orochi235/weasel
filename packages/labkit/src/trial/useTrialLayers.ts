import { useMemo } from 'react';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { applyCamera } from '../canvas/worldSpec';
import type { TrialClock } from '../clock/trialClock';
import type { OverAccess } from '../config/over';
import type { Instrument, LayerDescriptor } from '../instrument/types';
import type { LayerListItem } from '../passthrough/weasel-ui';

interface TrialLayersInput {
  instrument: Instrument;
  state: unknown;
  config: unknown;
  over: OverAccess | undefined;
  layerVisibility: Record<string, boolean>;
  layerOrder: readonly string[] | null;
  clock: TrialClock | undefined;
}

/** What a trial's layers look like to its canvas, its layer list and the
 *  instrument's render context. */
export function useTrialLayers({
  instrument,
  state,
  config,
  over,
  layerVisibility,
  layerOrder,
  clock,
}: TrialLayersInput) {
  const visibleLayers = useMemo(
    () =>
      (instrument.canvas?.layers ?? [])
        .filter((l) => layerVisibility[l.id] !== false)
        .map((l) => l.id),
    [instrument.canvas, layerVisibility],
  );

  const canvasLayers: CanvasLayerDescriptor[] = useMemo(() => {
    if (!instrument.canvas) return [];
    const baseLayers = instrument.canvas.layers;
    const ordered = layerOrder
      ? [...baseLayers].sort((a, b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id))
      : baseLayers;
    return ordered.map((layer) => ({
      id: layer.id,
      visible: layerVisibility[layer.id] !== false,
      timed: layer.timed === true,
      render: (ctx, view, frame) => {
        // Camera applied here, so a layer draws in world coordinates. `zoom`
        // stays in the args for line widths, which must not scale with it.
        applyCamera(ctx, view, frame);
        layer.draw(ctx, {
          state,
          config,
          ...(over ? { over } : {}),
          zoom: view.zoom,
          elapsed: clock?.elapsed ?? 0,
          pass: clock?.pass ?? 0,
          phase: clock?.phase ?? 0,
        });
      },
    }));
  }, [instrument.canvas, state, config, over, layerVisibility, layerOrder, clock]);

  const layerDescriptors: LayerDescriptor[] = useMemo(() => {
    if (!instrument.layers) return [];
    return instrument.layers.ids.map((l) => (typeof l === 'string' ? { id: l, label: l } : l));
  }, [instrument.layers]);

  // In the order the canvas draws them, with the always-on layers pinned
  // below the rest, where a drag cannot reach past them.
  const layerItems: LayerListItem[] = useMemo(() => {
    const ordered = layerOrder
      ? [...layerDescriptors].sort((a, b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id))
      : layerDescriptors;
    const pinnedLast = [
      ...ordered.filter((l) => !l.alwaysOn),
      ...ordered.filter((l) => l.alwaysOn),
    ];
    return pinnedLast.map((l) => ({
      id: l.id,
      label: l.label,
      fixed: l.alwaysOn === true,
      visible: l.alwaysOn === true || layerVisibility[l.id] !== false,
    }));
  }, [layerDescriptors, layerOrder, layerVisibility]);

  return { visibleLayers, canvasLayers, layerDescriptors, layerItems };
}
