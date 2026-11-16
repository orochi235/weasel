import { useMemo } from 'react';
import { shareToolOptions } from '@weasel-js/routing';
import { DEFAULT_TEXT_FILL } from '@weasel-js/text';
import { icon } from '../../icons.gen';
import { defineTool, INSERT_DRAG_MODS, INSERT_REPOSITION_BINDING, type Tool } from '@weasel-js/core';
import { insertBindingBehaviors, shapeToolOptions, type InsertToolOptions } from '@weasel-js/editing';

const PRESENTATION = {
  label: 'Text',
  icon: icon('core:text'),
  group: 'type',
};

/** The text tool's options: the fill new text is set in, shared under `textFill`. Not the shapes' `fill`: a white
 *  shape fill would set white text on a white page. */
export const TEXT_TOOL_OPTIONS = shareToolOptions(shapeToolOptions({
  actionId: 'insert', name: 'Text', keys: ['fill'], style: { fill: DEFAULT_TEXT_FILL.paint },
}), { fill: 'textFill' });

/** Text tool. Drag-rect insertion is owned end-to-end by the dispatcher's
 *  `insertAction` (kind: `'text'`); click-on-selected-text-node enters edit
 *  mode via the `enterTextEdit` action.
 *
 *  Its actions, the `text` insert and the `textEdit` dep come with
 *  `textPreset`. Custom node factories and hit gating belong on those deps,
 *  not on the tool. */
export function createTextTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return defineTool({
    id: 'text',
    keybinding: { key: 'T' },
    capabilities: ['creates-text'],
    hookName: 'useTextTool',
    options: shareToolOptions(TEXT_TOOL_OPTIONS, share),
    cursor: 'text',
    presentation: PRESENTATION,
    bindings: [
      { spec: { kind: 'drag', mods: INSERT_DRAG_MODS }, actionId: 'insert', opts: { id: 'text.drag', params: { kind: 'text' }, ...insertBindingBehaviors(behaviors) } },
      { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit', opts: { id: 'text.editText' } },
      INSERT_REPOSITION_BINDING,
    ],
  });
}

/** {@link createTextTool}, rebuilt only when an option changes. */
export function useTextTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(() => createTextTool({ behaviors, share }), [behaviors, share]);
}
