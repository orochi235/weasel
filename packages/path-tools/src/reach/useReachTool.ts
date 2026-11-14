import type { ToolKeybinding } from '@weasel-js/routing';
import { type Tool } from '@weasel-js/core';
import { useStrokeClickTool, type StrokeClickToolOptions } from '../shared/strokeClickTool';
import { icon } from '../icons.gen';

/** Options for `useReachTool`; the default keybinding is `{ key: 'U', shift: true }` (Shift+U). */
export type UseReachToolOptions = StrokeClickToolOptions;

const REACH_KEY: ToolKeybinding = { key: 'U', shift: true };

/**
 * Reach tool. A click near an open end of a stroke carries
 * that end along its tangent to the next stroke it meets — a declarative
 * shell over the `reachToMeet` action.
 */
export function useReachTool(options: UseReachToolOptions = {}): Tool {
  return useStrokeClickTool(
    {
      id: 'reach', label: 'Reach', icon: icon('reach'), hookName: 'useReachTool',
      actionId: 'reachToMeet', keybinding: REACH_KEY,
    },
    options,
  );
}
