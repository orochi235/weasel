import { usePageGrid, type PageGridOptions } from '@editor/index';
import type { AppCommands } from './appCommands';
import { usePref } from './prefs';

/**
 * The grid over `page`, driven by the View preferences: the layer to draw while it
 * is shown, the snap source to hand the canvas while snapping is on, and the
 * two toggles the command bar fires. The pitch drawn and the pitch snapped to are
 * the one "Grid density" preference.
 */
export function useGrid(page: PageGridOptions['page'], backgroundColor: string) {
  const [gridVisible, setGridVisible] = usePref('view.gridVisible');
  const [snapToGrid, setSnapToGrid] = usePref('view.snapToGrid');
  const [spacing] = usePref('view.gridDensity');

  const { layer, source } = usePageGrid({
    page, spacing, background: backgroundColor, accentEvery: 5, visible: gridVisible, snap: snapToGrid,
  });

  const commands: Pick<AppCommands, 'gridVisible' | 'toggleGrid' | 'snapToGrid' | 'toggleSnap'> = {
    gridVisible,
    toggleGrid: () => setGridVisible(!gridVisible),
    snapToGrid,
    toggleSnap: () => setSnapToGrid(!snapToGrid),
  };

  return {
    commands,
    layer,
    snapSource: source,
  };
}
