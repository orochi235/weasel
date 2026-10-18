import { contrastLineColor } from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import { useMemo } from 'react';
import type { AppCommands } from './appCommands';
import { usePref } from './prefs';

/**
 * The page grid, driven by the View preferences: the layer to draw while it
 * is shown, the snap source to hand the canvas while snapping is on, and the
 * two toggles the command bar fires. The pitch drawn and the pitch snapped to are
 * the one "Grid density" preference.
 */
export function useGrid(page: { width: number; height: number }, backgroundColor: string) {
  const [gridVisible, setGridVisible] = usePref('view.gridVisible');
  const [snapToGrid, setSnapToGrid] = usePref('view.snapToGrid');
  const [spacing] = usePref('view.gridDensity');

  const layer = useMemo(() => createGridLayer({
    spacing,
    bounds: () => ({ x: 0, y: 0, width: page.width, height: page.height }),
    accentEvery: 5,
    style: {
      line:   { paint: { kind: 'solid', color: contrastLineColor(backgroundColor, 0.06) }, width: 1 },
      accent: { paint: { kind: 'solid', color: contrastLineColor(backgroundColor, 0.14) }, width: 1 },
    },
  }), [spacing, page.width, page.height, backgroundColor]);

  const source = useMemo(() => gridSnapSource({ spacing }), [spacing]);

  const commands: Pick<AppCommands, 'gridVisible' | 'toggleGrid' | 'snapToGrid' | 'toggleSnap'> = {
    gridVisible,
    toggleGrid: () => setGridVisible(!gridVisible),
    snapToGrid,
    toggleSnap: () => setSnapToGrid(!snapToGrid),
  };

  return {
    commands,
    layer: gridVisible ? layer : undefined,
    snapSource: snapToGrid ? source : undefined,
  };
}
