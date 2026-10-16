import type { KitSettingsStore } from '@weasel-js/react';
import { modelToPlot, plotToModel, type ModelRange } from '../Plot2D/geometry';
import type { LayerCtx } from './layerTypes';

/** What a layer is told about one plot, short of the modifiers held at the moment it is asked. */
export function layerCtxOver(
  modelRange: ModelRange,
  plotSize: LayerCtx['plotSize'],
  kitSettings: KitSettingsStore,
): Omit<LayerCtx, 'modifiers'> {
  return {
    modelRange,
    plotSize,
    toPlot: (p) => modelToPlot(p, modelRange, plotSize),
    toModel: (p) => plotToModel(p, modelRange, plotSize),
    kitSettings,
  };
}
