import { useMemo, createElement } from 'react';
import { defineTool } from '../../routing';
import type { Tool } from '../../types';
import { TextIcon } from '../../../icons';

const PRESENTATION = {
  label: 'Text',
  icon: createElement(TextIcon),
  group: 'type',
};

/** Text tool. Drag-rect insertion is owned end-to-end by the dispatcher's
 *  `insertAction` (kind: `'text'`); click-on-selected-text-node enters edit
 *  mode via the `enterTextEdit` action.
 *
 *  Consumers must register both the `insert` dep (e.g. through
 *  `SceneCanvas`'s `useInsertDepSource`) and the `textEdit` dep
 *  (`enterTextEditAction`'s contract — see
 *  `src/interactions/actions/defaults/enterTextEdit.ts`). Custom node
 *  factories and hit gating belong on those deps, not on the tool. */
export function useTextTool(): Tool<undefined> {
  return useMemo<Tool<undefined>>(
    () =>
      defineTool<undefined>({
        id: 'text',
        capabilities: ['creates-text'],
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
