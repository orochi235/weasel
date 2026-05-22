import { useMemo, createElement } from 'react';
import { defineTool } from '../../routing';
import type { Tool } from '../../types';
import type { InsertAdapter } from 'core/adapters/types';
import { type InsertOverlayStyle } from '../marquee';
import { TextIcon } from '../../../icons';

export interface UseTextToolOptions<TNode extends { id: string }> {
  pointInsert: (point: { x: number; y: number }) => TNode | null;
  commitInsert?: InsertAdapter<TNode>['commitInsert'];
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  minBounds?: { width: number; height: number };
  marqueeStyle?: InsertOverlayStyle;
}

const PRESENTATION = {
  label: 'Text',
  icon: createElement(TextIcon),
  group: 'type',
};
/** Text Tool. Phase 14e Task 3.5: legacy `useInsert` hook dropped — drag-rect
 *  insertion is owned end-to-end by the dispatcher's `insertAction` (kind:
 *  'text'); click-on-selected-text-node enters edit mode via the
 *  `enterTextEdit` action.
 *
 *  Consumers must register both the `insert` dep (e.g. through `SceneCanvas`'s
 *  `useInsertDepSource`) and the `textEdit` dep (`enterTextEditAction`'s
 *  contract — see `src/interactions/actions/defaults/enterTextEdit.ts`).
 *
 *  Note: `pointInsert`, `hitExisting`, `marqueeStyle`, `minBounds` remain on
 *  the option surface for forward-compat but are currently ignored — they map
 *  onto dispatcher-side features that are wired through dep sources, not
 *  through the tool record. */
export function useTextTool<TNode extends { id: string }>(
  _options: UseTextToolOptions<TNode>,
): Tool<undefined> {
  return useMemo<Tool<undefined>>(
    () =>
      defineTool<undefined>({
        id: 'text',
        hookName: 'useTextTool',
        cursor: 'text',
        presentation: PRESENTATION,
        bindings: [
          { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: 'text' } } },
          { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit' },
        ],
        initial: {},
      }),
    [],
  );
}
