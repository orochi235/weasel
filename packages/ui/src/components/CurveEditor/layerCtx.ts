import type { KitSettingsStore } from '@weasel-js/react';
import { modelToPlot, plotToModel, type ModelRange } from '../Plot2D/geometry';
import type { LayerCtx, LayerModifiers } from './layerTypes';

/** What a layer sees held when no event says: a render, or a cancel. */
export const NO_MODIFIERS: LayerModifiers = { shift: false, alt: false, meta: false, ctrl: false };

/** The modifiers `e` was fired with. */
export function readModifiers(e: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): LayerModifiers {
  return { shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, ctrl: e.ctrlKey };
}

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
