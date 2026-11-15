import { useMemo } from 'react';
import { isAnchor } from '@weasel-js/routing';
import { defineTool, type Tool } from '@weasel-js/core';
import { icon } from '../icons.gen';
import type {} from '../actionParamSchema';

/**
 * Tug, a path-edit tool: a declarative shell whose one binding routes a
 * drag on an anchor to the `tugPath` action, which grows or trims the
 * path from the open end dragged. A drag that action turns down falls through
 * to anchor editing. It carries `edits-anchors`, so it is usable only where
 * the mode allows anchor editing.
 */
export function useTugTool(): Tool {
  return useMemo(() => defineTool({
    id: 'tug',
    capabilities: ['edits-anchors'],
    hookName: 'useTugTool',
    presentation: { label: 'Tug', group: 'path-edit', icon: icon('tug') },
    bindings: [{
      spec: { kind: 'drag', target: { kindOf: isAnchor }, mods: { shift: 'optional' } },
      actionId: 'tugPath',
      opts: { id: 'tug.drag' },
    }],
  }), []);
}
