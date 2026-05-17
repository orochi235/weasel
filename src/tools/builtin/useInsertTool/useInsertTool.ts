import { createElement } from 'react';
import { useInsert, type UseInsertOptions } from 'interactions/actions/insert/insert';
import type { InsertAdapter } from 'core/adapters/types';
import type { Tool } from '../../types';
import { defineDragInsertTool } from '../defineDragInsertTool';
import { type InsertOverlayStyle } from '../marquee';
import { RectIcon } from '../../../icons';

export type { InsertOverlayStyle };

export interface UseInsertToolOptions<TPose, TNode extends { id: string } = { id: string }>
  extends UseInsertOptions<TPose, TNode> {
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

const PRESENTATION = {
  label: 'Rectangle',
  icon: createElement(RectIcon),
  group: 'shape',
};
const DEFAULT_STYLE = { fill: 'rgba(127, 176, 105, 0.25)', stroke: '#7fb069', dash: [4, 4], lineWidth: 1 };

export function useInsertTool<TNode extends { id: string }, TPose>(
  adapter: InsertAdapter<TNode>,
  options: UseInsertToolOptions<TPose, TNode> = {},
): Tool<undefined> {
  const { hitExisting, overlayStyle, ...gestureOptions } = options;
  const controller = useInsert<TNode, TPose>(adapter, gestureOptions);
  const { tool } = defineDragInsertTool({
    id: 'insert',
    cursor: 'crosshair',
    presentation: PRESENTATION,
    controller,
    overlayId: 'insert-overlay',
    overlayLabel: 'Insert overlay',
    defaultStyle: DEFAULT_STYLE,
    overlayStyle,
    hitExisting,
  });
  return tool;
}
