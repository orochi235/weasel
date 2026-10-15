import type { ToolKeybinding } from '@weasel-js/routing';
import type { Tool } from '../../overlayBinding';
import { SliceIcon } from '../../../icons';
import { useStrokeClickTool, type StrokeClickToolOptions } from '../shared/strokeClickTool';

/** Options for `useExtendTool`; the default keybinding is `{ key: 'U' }`. */
export type UseExtendToolOptions = StrokeClickToolOptions;

const EXTEND_KEY: ToolKeybinding = { key: 'U' };

/**
 * Extend to next path tool. A click near an open end of a stroke carries
 * that end along its tangent to the next stroke it meets — a declarative
 * shell over the `extendToMeet` action.
 */
export function useExtendTool(options: UseExtendToolOptions = {}): Tool {
  return useStrokeClickTool(
    {
      id: 'extend', label: 'Extend to next path', icon: SliceIcon, hookName: 'useExtendTool',
      actionId: 'extendToMeet', keybinding: EXTEND_KEY,
    },
    options,
  );
}
