import { useMemo } from 'react';
import { shareToolOptions, type ToolKeybinding, type ToolOptionShare } from '@weasel-js/routing';
import { PATH_GROUP, defineTool, type Tool, type ToolOptions } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { KNEAD_PARAMS } from './knead';
import type {} from '../actionParamSchema';

/** Knead's size and strength: the `knead` action's params, the same form its last-operation
 *  panel shows. */
export const KNEAD_TOOL_OPTIONS = {
  actionId: 'knead',
  prefs: KNEAD_PARAMS,
  size: { option: 'radiusPx', times: 1.25 },
  strength: { option: 'strength', plus: 0.1 },
} satisfies ToolOptions;

/** Options for `useKneadTool`. */
export interface UseKneadToolOptions {
  /** Override the default keybinding (`{ key: 'U' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Laid over its options' shares: `{ radiusPx: BRUSH_SIZE_PX }` (`@weasel-js/brush`) gives it the size every
   *  brush naming that key shares. Keep it stable across renders. */
  share?: ToolOptionShare;
}

const KNEAD_KEY: ToolKeybinding = { key: 'U' };

/**
 * Knead tool. A round brush that pushes the outline of the selected
 * paths, or of every path while none is selected, along with the pointer — a declarative shell whose one binding routes a
 * drag to the `knead` action, which owns the stroke, its preview, its ring
 * cursor, and its one undo entry. The brush's radius (screen px) and strength are
 * its options ({@link KNEAD_TOOL_OPTIONS}): `[` and `]` resize it, `Shift+[` and
 * `Shift+]` weaken and strengthen it, and a host keeps their values in the
 * `toolOptionValues` dep.
 */
export function useKneadTool(options: UseKneadToolOptions = {}): Tool {
  const { keybinding = KNEAD_KEY, share } = options;
  return useMemo(() => defineTool({
    id: 'knead',
    ...(keybinding ? { keybinding } : {}),
    capabilities: ['creates-shapes'],
    hookName: 'useKneadTool',
    cursor: 'crosshair',
    presentation: { label: 'Knead', group: PATH_GROUP, icon: icon('knead') },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'knead', opts: { id: 'knead.drag' } }],
    options: shareToolOptions(KNEAD_TOOL_OPTIONS, share),
  }), [keybinding, share]);
}
