import { usePageGrid, type PageGridOptions } from '@weasel-js/editor';
import type { AppCommands } from './appCommands';
import { usePref } from './prefs';

/** The app commands {@link useGrid} answers. */
export type GridCommand = 'gridVisible' | 'toggleGrid' | 'snapToGrid' | 'toggleSnap' | 'snapping' | 'toggleSnapping';

/**
 * The grid over `page`, driven by the View preferences: the layer to draw while it
 * is shown, the snap source to hand the canvas while snapping to it is on, whether
 * anything snaps, and the toggles the command bar fires. The pitch drawn and the pitch
 * snapped to are the one "Grid density" preference.
 */
export function useGrid(page: PageGridOptions['page'], backgroundColor: string) {
  const [gridVisible, setGridVisible] = usePref('view.gridVisible');
  const [snapToGrid, setSnapToGrid] = usePref('view.snapToGrid');
  const [snapping, setSnapping] = usePref('view.snapping');
  const [spacing] = usePref('view.gridDensity');

  const { layer, source } = usePageGrid({
    page, spacing, background: backgroundColor, accentEvery: 5, visible: gridVisible, snap: snapToGrid,
  });

  const commands: Pick<AppCommands, GridCommand> = {
    gridVisible,
    toggleGrid: () => setGridVisible(!gridVisible),
    snapToGrid,
    toggleSnap: () => setSnapToGrid(!snapToGrid),
    snapping,
    toggleSnapping: () => setSnapping(!snapping),
  };

  return {
    commands,
    layer,
    snapSource: source,
  };
}
