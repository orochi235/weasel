import { useMemo } from 'react';
import { isAnchor } from '@weasel-js/routing';
import { defineTool, type Tool } from '@weasel-js/core';
import { icon } from '../icons.gen';

/**
 * Lengthen, a path-edit tool: a declarative shell whose one binding routes a
 * drag on an anchor to the `lengthenPath` action, which grows or trims the
 * path from the open end dragged. A drag that action turns down falls through
 * to anchor editing. It carries `edits-anchors`, so it is usable only where
 * the mode allows anchor editing.
 */
export function useLengthenTool(): Tool {
  return useMemo(() => defineTool({
    id: 'lengthen',
    capabilities: ['edits-anchors'],
    hookName: 'useLengthenTool',
    presentation: { label: 'Lengthen', group: 'path-edit', icon: icon('lengthen') },
    bindings: [{
      spec: { kind: 'drag', target: { kindOf: isAnchor }, mods: { shift: 'optional' } },
      actionId: 'lengthenPath',
      opts: { id: 'lengthenPath.drag' },
    }],
  }), []);
}
