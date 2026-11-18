import { usePageGrid, type PageGridOptions } from '@weasel-js/editor';
import type { AppCommands } from './appCommands';
import { usePref, usePrefGroup } from './prefs';

/** The app commands {@link useGrid} answers. */
export type GridCommand = 'gridVisible' | 'toggleGrid' | 'snapToGrid' | 'toggleSnap' | 'snapping' | 'toggleSnapping';

/**
 * The grid over `page`, driven by the View preferences' Grid group: the layer to draw while
 * it is shown, the snap source to hand the canvas while snapping to it is on, whether anything
 * snaps, and the toggles the command bar fires.
 */
export function useGrid(page: PageGridOptions['page'], backgroundColor: string) {
  const [grid, setGrid] = usePrefGroup('view.grid');
  const [snapping, setSnapping] = usePref('view.snapping');

  const { layer, source } = usePageGrid({ ...grid, page, background: backgroundColor });

  const commands: Pick<AppCommands, GridCommand> = {
    gridVisible: grid.visible,
    toggleGrid: () => setGrid({ visible: !grid.visible }),
    snapToGrid: grid.snap,
    toggleSnap: () => setGrid({ snap: !grid.snap }),
    snapping,
    toggleSnapping: () => setSnapping(!snapping),
  };

  return {
    commands,
    layer,
    snapSource: source,
  };
}
