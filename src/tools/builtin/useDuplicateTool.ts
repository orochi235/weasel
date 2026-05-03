import { useMemo } from 'react';
import { useDuplicate, type DuplicateAdapter, type UseDuplicateOptions } from '../../interactions/actions/duplicate/duplicate';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseDuplicateToolOptions extends UseDuplicateOptions {}

/** Always-on Tool wrapping `useDuplicate`. Handles Mod+D (meta or ctrl)
 *  for cross-platform support. The legacy hook's document keybinding is
 *  suppressed by passing `enableKeyboard: false`. */
export function useDuplicateTool<TPose>(
  adapter: DuplicateAdapter<TPose>,
  options: UseDuplicateToolOptions = {},
): Tool<undefined> {
  const ctl = useDuplicate(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'duplicate',
        keybinding: 'meta+d',
        keyboard: {
          onDown: (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod || e.key.toLowerCase() !== 'd') return 'pass';
            ctl.duplicate();
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
