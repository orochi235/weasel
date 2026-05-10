import { useInsert, type UseInsertOptions } from 'interactions/gestures/insert/insert';
import type { InsertAdapter } from 'core/adapters/types';
import type { Tool } from '../types';
import { defineDragInsertTool } from './defineDragInsertTool';
import { type InsertOverlayStyle } from './marquee';

export type { InsertOverlayStyle };

export interface UseInsertToolOptions<TPose, TObject extends { id: string } = { id: string }>
  extends UseInsertOptions<TPose, TObject> {
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

export function useInsertTool<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertToolOptions<TPose, TObject> = {},
): Tool<undefined> {
  const { hitExisting, overlayStyle, ...gestureOptions } = options;
  const controller = useInsert<TObject, TPose>(adapter, gestureOptions);
  const { tool } = defineDragInsertTool({
    id: 'insert',
    cursor: 'crosshair',
    controller,
    overlayId: 'insert-overlay',
    overlayLabel: 'Insert overlay',
    defaultStyle: { fill: 'rgba(127, 176, 105, 0.25)', stroke: '#7fb069', dash: [4, 4], lineWidth: 1 },
    overlayStyle,
    hitExisting,
  });
  return tool;
}
