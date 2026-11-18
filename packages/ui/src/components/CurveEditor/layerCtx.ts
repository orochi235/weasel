import { useCallback, useMemo } from 'react';
import { useKitSettings, useLatest, type KitSettingsStore } from '@weasel-js/react';
import { modelToPlot, plotToModel, type ModelRange } from '../Plot2D/geometry';
import type { ModifierState } from '@weasel-js/routing';
import type { LayerCtx } from './layerTypes';

/** What a layer sees held when no event says: a render, or a cancel. */
export const NO_MODIFIERS: ModifierState = { shift: false, alt: false, meta: false, ctrl: false };

/** The modifiers `e` was fired with. */
export function readModifiers(e: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }): ModifierState {
  return { shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, ctrl: e.ctrlKey };
}

/**
 * The layer context for a plot of `width` by `height` over the given ranges: `base` for drawing, and `ctxFor` for a
 * handler, which reads the plot through refs so a mid-drag re-render (another layer's state included) reaches the
 * next move.
 */
export function usePlotLayerCtx(
  xRange: readonly [number, number], yRange: readonly [number, number], width: number, height: number,
) {
  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );
  const plotSize = useMemo(() => ({ width, height }), [width, height]);
  const modelRangeRef = useLatest(modelRange);
  const plotSizeRef = useLatest(plotSize);
  const kitSettings = useKitSettings();
  const ctxFor = useCallback(
    (modifiers: ModifierState): LayerCtx => ({ ...layerCtxOver(modelRangeRef.current, plotSizeRef.current, kitSettings), modifiers }),
    [modelRangeRef, plotSizeRef, kitSettings],
  );
  const base = useMemo(() => layerCtxOver(modelRange, plotSize, kitSettings), [modelRange, plotSize, kitSettings]);
  return { ctxFor, base };
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
